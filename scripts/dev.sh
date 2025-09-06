#!/bin/bash

# Dep Version Lens 开发脚本 / Development Script

echo "🚀 Starting Dep Version Lens development..."

# 安装依赖 / Install dependencies
echo "📦 Installing dependencies..."
npm install

# 编译TypeScript / Compile TypeScript
echo "🔨 Compiling TypeScript..."
npm run compile

# 运行测试 / Run tests
echo "🧪 Running tests..."
npm test

# 启动监听模式 / Start watch mode
echo "👀 Starting watch mode..."
echo "Press F5 in VS Code to launch extension development host"
npm run watch