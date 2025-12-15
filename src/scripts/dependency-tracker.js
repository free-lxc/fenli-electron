/**
 * 依赖追踪模块
 * 用于递归追踪文件的所有依赖关系
 */

const fs = require('fs');
const path = require('path');
const { resolveDependency, findFile, toAliasPath, parseImports, parseStyleImports, detectSrcRoot } = require('./utils');

class DependencyTracker {
    constructor(options = {}) {
        this.projectRoot = options.projectRoot || process.cwd();
        this.srcRoot = options.srcRoot || detectSrcRoot(this.projectRoot);
        this.maxDepth = options.maxDepth || 30;
        // 排除的目录列表（相对于项目根目录）
        this.excludeDirs = options.excludeDirs || [];
        
        // 已追踪的文件集合（避免循环依赖）
        this.trackedFiles = new Set();
        // 依赖关系图：filePath -> [dependencies]
        this.dependencyGraph = new Map();
    }
    
    /**
     * 检查文件是否应该被排除
     */
    shouldExclude(filePath) {
        if (!this.excludeDirs || this.excludeDirs.length === 0) {
            return false;
        }
        
        try {
            const relativePath = path.relative(this.projectRoot, filePath);
            
            return this.excludeDirs.some(excludeDir => {
                if (!excludeDir || excludeDir.trim() === '') {
                    return false;
                }
                
                // 支持相对路径和绝对路径
                const normalizedExclude = path.normalize(excludeDir.trim());
                const normalizedPath = path.normalize(relativePath);
                
                // 检查路径是否以排除目录开头，或包含排除目录
                return normalizedPath.startsWith(normalizedExclude) || 
                       normalizedPath.includes(path.join(normalizedExclude, path.sep)) ||
                       normalizedPath.startsWith(path.join(normalizedExclude, path.sep));
            });
        } catch (error) {
            // 如果路径处理出错，不排除该文件
            return false;
        }
    }

    /**
     * 递归追踪文件依赖
     */
    trackDependencies(filePath, depth = 0) {
        // 防止无限递归
        if (depth > this.maxDepth) {
            return;
        }
        
        // 转换为绝对路径
        let absolutePath = filePath;
        if (!path.isAbsolute(filePath)) {
            absolutePath = path.resolve(this.projectRoot, filePath);
        }
        
        // 规范化路径
        const normalizedPath = path.normalize(absolutePath);
        
        // 跳过已追踪的文件
        if (this.trackedFiles.has(normalizedPath)) {
            return;
        }
        
        // 只追踪项目内部文件
        if (!normalizedPath.startsWith(this.projectRoot)) {
            return;
        }
        
        // 跳过 node_modules
        if (normalizedPath.includes('node_modules')) {
            return;
        }
        
        // 检查是否在排除目录中
        if (this.shouldExclude(normalizedPath)) {
            return;
        }
        
        // 查找实际文件
        const actualFile = findFile(normalizedPath);
        if (!actualFile) {
            return;
        }
        
        // 标记为已追踪
        this.trackedFiles.add(normalizedPath);
        
        // 初始化依赖列表
        if (!this.dependencyGraph.has(normalizedPath)) {
            this.dependencyGraph.set(normalizedPath, []);
        }
        
        // 判断是否为样式文件
        const isStyleFile = /\.(less|css)$/.test(actualFile);
        
        // 解析依赖
        try {
            const imports = isStyleFile 
                ? parseStyleImports(actualFile)
                : parseImports(actualFile);
            
            for (const importPath of imports) {
                try {
                    const resolvedPath = resolveDependency(importPath, actualFile, this.srcRoot, this.projectRoot);
                    if (resolvedPath) {
                        const foundFile = findFile(resolvedPath);
                        if (foundFile) {
                            const normalizedDep = path.normalize(foundFile);
                            // 只追踪项目内部文件，且不在排除目录中
                            if (normalizedDep.startsWith(this.projectRoot) && 
                                !normalizedDep.includes('node_modules') &&
                                !this.shouldExclude(normalizedDep)) {
                                this.dependencyGraph.get(normalizedPath).push(normalizedDep);
                                // 递归追踪
                                this.trackDependencies(normalizedDep, depth + 1);
                            }
                        }
                    }
                } catch (err) {
                    // 忽略单个依赖解析错误，继续处理其他依赖
                    // console.warn(`解析依赖失败: ${importPath}`, err.message);
                }
            }
        } catch (err) {
            // 忽略文件解析错误，继续处理其他文件
            // console.warn(`解析文件失败: ${actualFile}`, err.message);
        }
        
        // 自动查找同名的样式文件
        if (!isStyleFile) {
            const ext = path.extname(actualFile);
            const basePath = actualFile.replace(ext, '');
            const styleExtensions = ['.less', '.css'];
            
            for (const styleExt of styleExtensions) {
                const styleFile = basePath + styleExt;
                if (fs.existsSync(styleFile)) {
                    const normalizedStyle = path.normalize(styleFile);
                    if (!this.trackedFiles.has(normalizedStyle)) {
                        this.trackedFiles.add(normalizedStyle);
                        if (!this.dependencyGraph.has(normalizedPath)) {
                            this.dependencyGraph.set(normalizedPath, []);
                        }
                        this.dependencyGraph.get(normalizedPath).push(normalizedStyle);
                        // 追踪样式文件的依赖
                        this.trackDependencies(normalizedStyle, depth + 1);
                    }
                }
            }
        }
    }

    /**
     * 获取依赖关系图（使用 @/ 格式）
     */
    getDependencyGraph() {
        const graph = {};
        
        for (const [filePath, deps] of this.dependencyGraph.entries()) {
            const aliasPath = toAliasPath(filePath, this.srcRoot);
            graph[aliasPath] = deps.map(dep => toAliasPath(dep, this.srcRoot)).sort();
        }
        
        return graph;
    }

    /**
     * 获取统计信息
     */
    getStatistics() {
        const stats = {
            totalFiles: this.trackedFiles.size,
            filesByType: {
                js: 0,
                jsx: 0,
                ts: 0,
                tsx: 0,
                less: 0,
                css: 0,
                other: 0
            },
            totalDependencies: 0
        };
        
        for (const filePath of this.trackedFiles) {
            const ext = path.extname(filePath);
            if (ext === '.js') stats.filesByType.js++;
            else if (ext === '.jsx') stats.filesByType.jsx++;
            else if (ext === '.ts') stats.filesByType.ts++;
            else if (ext === '.tsx') stats.filesByType.tsx++;
            else if (ext === '.less') stats.filesByType.less++;
            else if (ext === '.css') stats.filesByType.css++;
            else stats.filesByType.other++;
            
            const deps = this.dependencyGraph.get(filePath) || [];
            stats.totalDependencies += deps.length;
        }
        
        return stats;
    }

    /**
     * 重置追踪状态
     */
    reset() {
        this.trackedFiles.clear();
        this.dependencyGraph.clear();
    }
}

module.exports = DependencyTracker;

