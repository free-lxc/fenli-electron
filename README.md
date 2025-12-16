# 依赖分析工具 (Dependency Analyzer)

一个基于 Electron 的桌面应用程序，用于可视化分析 JavaScript/TypeScript 项目的依赖关系。

## 📋 目录

- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [安装步骤](#安装步骤)
- [使用方法](#使用方法)
- [项目结构](#项目结构)
- [开发指南](#开发指南)
- [构建打包](#构建打包)
- [常见问题](#常见问题)
- [许可证](#许可证)

## ✨ 功能特性

### 核心功能

- **路径分析模式**：直接分析本地文件系统中的项目
- **ZIP 文件分析模式**：上传并分析 ZIP 压缩的项目文件
- **多入口文件支持**：支持同时分析多个入口文件，自动汇总结果
- **智能路径验证**：自动验证入口文件是否属于指定项目，列出无效文件
- **依赖关系可视化**：以图形方式展示项目的依赖关系
- **目录树展示**：可视化展示项目的目录结构
- **统计信息**：显示总文件数、总依赖数、文件类型统计等
- **报告导出**：生成 Markdown 格式的分析报告

### 高级特性

- **排除目录配置**：支持排除 `node_modules`、`dist`、`build` 等目录
- **错误处理**：完善的错误提示和异常处理机制
- **批量分析**：支持多个入口文件批量分析，结果自动合并去重
- **项目根目录检测**：自动检测 ZIP 解压后的实际项目根目录

## 🛠 技术栈

- **框架**：Electron 39.1.2
- **前端**：React 18.2.0 + TypeScript 4.5.5
- **UI 组件库**：Ant Design 5.11.0
- **构建工具**：Vite 5.4.21
- **打包工具**：Electron Forge 7.10.2
- **样式**：Less
- **包管理**：pnpm

## 📦 安装步骤

### 前置要求

- Node.js >= 16.x
- pnpm (推荐) 或 npm/yarn

### 安装依赖

```bash
# 使用 pnpm (推荐)
pnpm install

# 或使用 npm
npm install

# 或使用 yarn
yarn install
```

## 🚀 使用方法

### 启动开发环境

```bash
pnpm start
```

### 路径分析模式

1. 切换到"路径分析"标签页
2. （可选）选择或输入项目根目录
3. 输入入口文件路径（支持多个，每行一个或逗号分隔）
   - 例如：`src/index.js`
   - 或多个文件：
     ```
     src/index.js
     src/app.js
     src/components/App.js
     ```
4. （可选）配置排除目录，如：`node_modules, dist, build`
5. 点击"开始分析"按钮

### ZIP 文件分析模式

1. 切换到"ZIP 文件分析"标签页
2. 输入入口文件路径（相对于项目根目录，支持多个）
   - 例如：`src/index.js`
   - 或多个文件：
     ```
     src/index.js
     src/app.js
     ```
3. （可选）配置排除目录
4. 点击"选择 ZIP 文件并分析"按钮
5. 在弹出的文件选择对话框中选择 ZIP 文件

### 查看分析结果

分析完成后，可以查看：

- **统计信息**：总文件数、总依赖数、文件类型统计
- **目录树结构**：项目的目录结构可视化
- **依赖关系图**：以图形方式展示依赖关系
- **JSON 数据**：原始依赖数据的 JSON 格式

### 导出报告

点击"下载报告"按钮，可以下载 Markdown 格式的分析报告。

## 📁 项目结构

```
fenli-electron/
├── src/
│   ├── main.ts                 # Electron 主进程入口
│   ├── preload.ts              # Preload 脚本，暴露安全的 API
│   ├── ipc-handlers.ts         # IPC 处理器
│   ├── renderer/
│   │   ├── App.tsx             # 主应用组件
│   │   ├── App.less            # 样式文件
│   │   ├── components/         # React 组件
│   │   │   ├── DirectoryTreeView/    # 目录树视图
│   │   │   ├── DependencyGraphView/  # 依赖关系图视图
│   │   │   └── DirectoryTree/        # 目录树组件
│   │   └── services/
│   │       └── index.ts        # 服务层，封装 IPC 调用
│   ├── utils/
│   │   └── dependency-analyzer.ts  # 依赖分析核心逻辑
│   └── scripts/                # 分析脚本
│       ├── index.js            # 依赖分析主脚本
│       ├── dependency-tracker.js
│       ├── directory-tree.js
│       └── utils.js
├── package.json
├── tsconfig.json
├── vite.main.config.ts         # 主进程 Vite 配置
├── vite.preload.config.ts     # Preload Vite 配置
├── vite.renderer.config.ts     # 渲染进程 Vite 配置
└── forge.config.ts            # Electron Forge 配置
```

## 💻 开发指南

### 代码规范

项目使用 ESLint 进行代码检查：

```bash
pnpm lint
```

### 主要功能模块

#### 1. 依赖分析核心 (`src/utils/dependency-analyzer.ts`)

- `analyzeByPath`: 通过文件路径分析依赖
- `analyzeByPathBatch`: 批量分析多个入口文件
- `analyzeByUpload`: 分析上传的 ZIP 文件
- `validateEntryFiles`: 验证入口文件是否属于项目
- `mergeAnalysisResults`: 合并多个分析结果

#### 2. IPC 通信 (`src/ipc-handlers.ts`)

- `analyze-dependencies`: 单文件依赖分析
- `analyze-dependencies-batch`: 批量依赖分析
- `select-and-analyze-zip`: 选择并分析 ZIP 文件
- `select-project-directory`: 选择项目目录
- `select-entry-file`: 选择入口文件

#### 3. UI 组件 (`src/renderer/App.tsx`)

- 支持两种分析模式切换
- 多入口文件输入和验证
- 分析结果展示和报告导出

## 📦 构建打包

### 打包应用

```bash
# 打包为可分发的应用
pnpm package

# 构建安装包
pnpm make
```

打包后的文件将输出到 `out/` 目录。

### 支持的平台

- macOS (darwin)
- Windows
- Linux

## ❓ 常见问题

### Q: 如何分析多个入口文件？

A: 在入口文件输入框中，每行输入一个文件路径，或使用逗号分隔。系统会自动验证每个文件是否属于项目，并汇总分析结果。

### Q: 为什么有些入口文件显示为无效？

A: 如果提供了项目根目录，系统会验证每个入口文件是否在该目录下。不属于项目的文件会被标记为无效并列出。

### Q: 如何排除某些目录？

A: 在"排除目录"输入框中，输入要排除的目录名称，用逗号或换行分隔。例如：`node_modules, dist, build`。

### Q: ZIP 文件分析失败怎么办？

A: 
1. 确保 ZIP 文件格式正确
2. 检查入口文件路径是否正确（相对于项目根目录）
3. 查看错误提示信息，系统会显示解压后的目录结构帮助定位问题

### Q: 分析结果中的统计信息如何理解？

A:
- **总文件数**：分析到的所有文件数量
- **总依赖数**：所有文件之间的依赖关系总数
- **JavaScript 文件**：`.js` 文件数量
- **TypeScript 文件**：`.ts` 和 `.tsx` 文件数量总和

## 📝 更新日志

### v1.0.0

- ✅ 支持路径分析和 ZIP 文件分析两种模式
- ✅ 支持多入口文件批量分析
- ✅ 自动验证入口文件路径
- ✅ 依赖关系可视化
- ✅ 目录树展示
- ✅ Markdown 报告导出

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 👤 作者

- **liuxu**

---

如有问题或建议，请提交 Issue 或联系作者。

