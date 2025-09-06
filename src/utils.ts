import { PackageInfo } from './types';

/**
 * 比较两个版本号
 * @param current 当前版本
 * @param latest 最新版本
 * @returns true if latest > current
 */
export function isVersionOutdated(current: string, latest: string): boolean {
  if (!current || !latest) return false;

  // 清理版本号，移除前缀符号
  const cleanCurrent = current.replace(/^[~^>=<!=]+/, '');
  const cleanLatest = latest.replace(/^[~^>=<!=]+/, '');

  const currentParts = cleanCurrent.split('.').map(Number);
  const latestParts = cleanLatest.split('.').map(Number);

  const maxLength = Math.max(currentParts.length, latestParts.length);

  for (let i = 0; i < maxLength; i++) {
    const currentPart = currentParts[i] || 0;
    const latestPart = latestParts[i] || 0;

    if (latestPart > currentPart) return true;
    if (latestPart < currentPart) return false;
  }

  return false;
}

/**
 * 提取版本约束操作符
 * @param versionSpec 版本规范字符串
 * @returns 操作符和版本号
 */
export function parseVersionSpec(versionSpec: string): { operator: string; version: string } {
  const match = versionSpec.match(/^([~^>=<!=]+)?(.+)$/);
  return {
    operator: match?.[1] || '',
    version: match?.[2] || versionSpec
  };
}

/**
 * 检查包名是否应该被排除
 * @param packageName 包名
 * @param excludePatterns 排除模式数组
 * @returns true if should be excluded
 */
export function shouldExcludePackage(packageName: string, excludePatterns: string[]): boolean {
  return excludePatterns.some(pattern => {
    const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
    return regex.test(packageName);
  });
}

/**
 * 创建包信息对象的通用函数
 */
export function createPackageInfo(
  name: string,
  version: string | null,
  operator: string,
  lineIndex: number,
  startChar: number,
  filePath: string
): PackageInfo {
  return {
    name,
    currentVersion: version,
    latestVersion: '',
    line: lineIndex,
    startChar: Math.max(0, startChar),
    endChar: startChar + name.length + (version ? version.length + operator.length : 0),
    isOutdated: false,
    versionConstraint: operator,
    filePath
  };
}

/**
 * 在文档中查找包的行索引
 */
export function findPackageLineIndex(content: string, searchText: string): number {
  const lines = content.split('\n');
  return Math.max(0, lines.findIndex(line => line.includes(searchText)));
}

/**
 * 解析版本号为数字数组
 */
export function parseVersion(version: string): number[] {
  return version.replace(/^[~^>=<!=]+/, '').split('.').map(Number);
}

/**
 * 比较两个版本号
 * @returns -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = parseVersion(v1);
  const parts2 = parseVersion(v2);
  const maxLength = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLength; i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;
    
    if (part1 < part2) return -1;
    if (part1 > part2) return 1;
  }
  return 0;
}

/**
 * 获取版本的升级选项
 */
export function getVersionUpgradeOptions(currentVersionSpec: string, allVersions: string[]): {
  satisfies: string | null;
  major: string | null;
  minor: string | null;
  patch: string | null;
} {
  if (!currentVersionSpec || !allVersions.length) {
    return { satisfies: null, major: null, minor: null, patch: null };
  }

  // 解析版本规范
  const { operator, version: currentVersion } = parseVersionSpec(currentVersionSpec);
  const current = parseVersion(currentVersion);
  const [currentMajor, currentMinor, currentPatch] = current;

  // 过滤并排序版本
  const validVersions = allVersions
    .filter(v => /^\d+\.\d+(\.\d+)?/.test(v))
    .sort((a, b) => compareVersions(b, a)); // 降序排列

  let satisfies: string | null = null;
  let major: string | null = null;
  let minor: string | null = null;
  let patch: string | null = null;

  // 首先找到满足当前约束的最新版本 (satisfies)
  for (const version of validVersions) {
    const satisfiesResult = satisfiesConstraint(version, operator, currentVersion);
    const isNewer = compareVersions(version, currentVersion) > 0;
    
    if (satisfiesResult && isNewer) {
      satisfies = version;
      break; // 因为已经按降序排列，第一个满足条件的就是最新的
    }
  }
  
  // 如果没有找到satisfies版本，且是精确版本约束，则使用patch版本
  if (!satisfies && (operator === '' || operator === '==')) {
    for (const version of validVersions) {
      const parsed = parseVersion(version);
      const [vMajor, vMinor, vPatch] = parsed;
      
      if (vMajor === currentMajor && vMinor === currentMinor && vPatch > (currentPatch || 0)) {
        satisfies = version;
        break;
      }
    }
  }

  // 然后找其他升级选项
  for (const version of validVersions) {
    const parsed = parseVersion(version);
    const [vMajor, vMinor, vPatch] = parsed;

    // 跳过当前版本或更低版本
    if (compareVersions(version, currentVersion) <= 0) continue;

    // 最新主版本 (major)
    if (!major && vMajor > currentMajor) {
      major = version;
    }

    // 最新次版本 (minor) - 同一主版本下的最新次版本
    if (!minor && vMajor === currentMajor && vMinor > currentMinor) {
      minor = version;
    }

    // 最新修订版本 (patch) - 同一主次版本下的最新修订版本
    if (!patch && vMajor === currentMajor && vMinor === currentMinor && vPatch > (currentPatch || 0)) {
      patch = version;
    }
  }

  return { satisfies, major, minor, patch };
}

/**
 * 根据版本约束计算satisfies版本
 */
export function calculateSatisfiesVersion(currentSpec: string, allVersions: string[]): string | null {
  const { operator, version } = parseVersionSpec(currentSpec);
  const current = parseVersion(version);
  
  const validVersions = allVersions
    .filter(v => /^\d+\.\d+(\.\d+)?/.test(v))
    .sort((a, b) => compareVersions(b, a));

  for (const v of validVersions) {
    if (satisfiesConstraint(v, operator, version)) {
      return v;
    }
  }
  
  return null;
}

/**
 * 解析 PEP 508 包名，支持 extras 语法
 * @param packageSpec 包规范字符串，如 "package[extra1,extra2]>=1.0.0"
 * @returns 解析结果包含完整包名、基础包名和版本部分
 */
export function parsePEP508PackageSpec(packageSpec: string): {
  fullName: string;
  baseName: string;
  versionPart: string;
} | null {
  // 支持 PEP 508 extras 语法: package[extra1,extra2]>=version
  const match = packageSpec.match(/^([a-zA-Z0-9_.-]+(?:\[[a-zA-Z0-9_,.-]*\])?)(.*)$/);
  if (!match) return null;

  const fullName = match[1];
  const baseName = fullName.split('[')[0];
  const versionPart = match[2].split(/[;#]/)[0].trim(); // 移除环境标记和注释

  return { fullName, baseName, versionPart };
}

/**
 * 验证 Python 包名是否有效
 * @param packageName 包名（基础包名，不包含extras）
 * @returns 是否为有效的包名
 */
export function isValidPythonPackageName(packageName: string): boolean {
  // Python包名规则：只能包含字母、数字、连字符和下划线，不能包含斜杠或@符号
  const validPattern = /^[a-zA-Z0-9_-]+$/;
  return validPattern.test(packageName) && !packageName.includes('/') && !packageName.includes('@');
}

/**
 * 检查版本是否满足约束
 */
function satisfiesConstraint(version: string, operator: string, constraintVersion: string): boolean {
  const cmp = compareVersions(version, constraintVersion);
  const vParts = parseVersion(version);
  const cParts = parseVersion(constraintVersion);
  
  switch (operator) {
    case '==': 
    case '': // 精确版本
      return cmp === 0;
    case '>=': return cmp >= 0;
    case '>': return cmp > 0;
    case '<=': return cmp <= 0;
    case '<': return cmp < 0;
    case '!=': return cmp !== 0;
    case '~=': // Python兼容版本
      return vParts[0] === cParts[0] && vParts[1] === cParts[1] && cmp >= 0;
    case '^': // npm caret范围 - 兼容主版本
      return vParts[0] === cParts[0] && cmp >= 0;
    case '~': // npm tilde范围 - 兼容次版本
      return vParts[0] === cParts[0] && vParts[1] === cParts[1] && cmp >= 0;
    default: 
      // 如果没有操作符，默认为>=
      return cmp >= 0;
  }
}