#!/usr/bin/env node
/**
 * 依赖分析工具 - 主入口文件
 * 
 * 功能：
 * 1. 从入口文件追踪所有依赖关系
 * 2. 生成依赖关系图
 * 3. 生成目录树结构
 * 4. 将结果写入 Markdown 文档
 * 
 * 用法:
 *   node scripts/index.js [选项]
 * 
 * 选项:
 *   --entry <file>      入口文件路径 (必需)
 *   --project-root <dir> 项目根目录 (默认: 当前目录)
 *   --output <file>     输出的 markdown 文件路径 (默认: dependency-report.md)
 *   --title <title>     文档标题 (默认: 依赖关系图)
 *   --max-depth <num>   最大追踪深度 (默认: 30)
 *   --tree-depth <num>  目录树最大深度 (默认: 10)
 *   --show-deps         显示依赖数量 (默认: true)
 *   --no-show-deps      不显示依赖数量
 *   --help, -h          显示帮助信息
 */

const fs = require('fs');
const path = require('path');
const DependencyTracker = require('./dependency-tracker');
const { buildDirectoryTree, generateTreeString } = require('./directory-tree');
const { generateMarkdown } = require('./markdown-generator');

// 解析命令行参数
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        entry: null,
        projectRoot: process.cwd(),
        output: 'dependency-report.md',
        title: '依赖关系图',
        maxDepth: 30,
        treeDepth: 10,
        showDeps: true,
        help: false
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--help' || arg === '-h') {
            options.help = true;
        } else if (arg === '--entry' || arg === '-e') {
            options.entry = args[++i];
        } else if (arg === '--project-root' || arg === '-p') {
            options.projectRoot = args[++i];
        } else if (arg === '--output' || arg === '-o') {
            options.output = args[++i];
        } else if (arg === '--title' || arg === '-t') {
            options.title = args[++i];
        } else if (arg === '--max-depth') {
            options.maxDepth = parseInt(args[++i], 10) || 30;
        } else if (arg === '--tree-depth') {
            options.treeDepth = parseInt(args[++i], 10) || 10;
        } else if (arg === '--show-deps') {
            options.showDeps = true;
        } else if (arg === '--no-show-deps') {
            options.showDeps = false;
        }
    }

    return options;
}

/**
 * 分析依赖关系（供外部调用）
 */
function analyzeDependencies(options) {
    const {
        entryFile,
        projectRoot = process.cwd(),
        maxDepth = 30,
        treeDepth = 10,
        showDeps = true,
        excludeDirs = []
    } = options;

    // 解析入口文件路径
    let entryPath = entryFile;
    if (!path.isAbsolute(entryPath)) {
        entryPath = path.resolve(projectRoot, entryPath);
    }
    
    // 检查入口文件是否存在
    if (!fs.existsSync(entryPath)) {
        throw new Error(`入口文件不存在: ${entryPath}`);
    }
    
    // 初始化依赖追踪器
    const tracker = new DependencyTracker({
        projectRoot,
        maxDepth,
        excludeDirs: Array.isArray(excludeDirs) ? excludeDirs : (excludeDirs ? [excludeDirs] : [])
    });
    
    // 追踪依赖关系
    tracker.trackDependencies(entryPath);
    
    // 获取依赖关系图
    const dependencyGraph = tracker.getDependencyGraph();
    
    // 获取统计信息
    const statistics = tracker.getStatistics();
    
    // 生成目录树
    const tree = buildDirectoryTree(dependencyGraph);
    const directoryTree = generateTreeString(tree, {
        maxDepth: treeDepth,
        showDeps
    });
    
    // 获取相对路径作为入口文件标识
    const relativeEntryPath = path.relative(projectRoot, entryPath);
    
    return {
        entryFile: relativeEntryPath,
        dependencyGraph,
        directoryTree,
        statistics
    };
}

/**
 * 主函数（命令行模式）
 */
function main() {
    const options = parseArgs();
    
    if (options.help) {
        const helpText = `依赖分析工具

用法:
  node scripts/index.js [选项]

选项:
  --entry <file>        入口文件路径 (必需)
  --project-root <dir>   项目根目录 (默认: 当前目录)
  --output <file>       输出的 markdown 文件路径 (默认: dependency-report.md)
  --title <title>       文档标题 (默认: 依赖关系图)
  --max-depth <num>     最大追踪深度 (默认: 30)
  --tree-depth <num>    目录树最大深度 (默认: 10)
  --show-deps           显示依赖数量 (默认: true)
  --no-show-deps        不显示依赖数量
  --help, -h            显示帮助信息

示例:
  node scripts/index.js --entry src/index.js
  node scripts/index.js --entry src/index.js --project-root /path/to/project
`;
        console.log(helpText);
        process.exit(0);
    }
    
    // 检查必需参数
    if (!options.entry) {
        console.error('错误: 必须指定入口文件 (--entry)');
        console.error('使用 --help 查看帮助信息');
        process.exit(1);
    }
    
    const projectRoot = path.resolve(options.projectRoot);
    
    // 解析入口文件路径
    let entryPath = options.entry;
    if (!path.isAbsolute(entryPath)) {
        entryPath = path.resolve(projectRoot, entryPath);
    }
    
    // 检查入口文件是否存在
    if (!fs.existsSync(entryPath)) {
        console.error(`错误: 入口文件不存在: ${entryPath}`);
        process.exit(1);
    }
    
    console.log('='.repeat(60));
    console.log('依赖分析工具');
    console.log('='.repeat(60));
    console.log(`项目根目录: ${projectRoot}`);
    console.log(`入口文件: ${entryPath}`);
    console.log(`输出文件: ${options.output}`);
    console.log('');
    
    try {
        const result = analyzeDependencies({
            entryFile: entryPath,
            projectRoot,
            maxDepth: options.maxDepth,
            treeDepth: options.treeDepth,
            showDeps: options.showDeps
        });
        
        console.log('📊 分析结果:');
        console.log(`   - 总文件数: ${result.statistics.totalFiles}`);
        console.log(`   - 总依赖数: ${result.statistics.totalDependencies}`);
        console.log(`   - 文件类型:`, result.statistics.filesByType);
        console.log('');
        
        // 生成 Markdown 文档
        const markdown = generateMarkdown({
            entryFile: result.entryFile,
            dependencyGraph: result.dependencyGraph,
            directoryTree: result.directoryTree,
            statistics: result.statistics,
            title: options.title
        });
        
        // 保存文件
        const outputPath = path.resolve(projectRoot, options.output);
        fs.writeFileSync(outputPath, markdown, 'utf-8');
        
        console.log('='.repeat(60));
        console.log('✅ 分析完成！');
        console.log(`📄 报告已保存到: ${outputPath}`);
        console.log('='.repeat(60));
        
    } catch (error) {
        console.error('❌ 错误:', error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main();
}

module.exports = {
    analyzeDependencies,
    DependencyTracker,
    buildDirectoryTree,
    generateTreeString,
    generateMarkdown
};

