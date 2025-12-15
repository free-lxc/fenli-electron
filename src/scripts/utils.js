/**
 * 工具函数模块
 */

const fs = require('fs');
const path = require('path');

/**
 * 解析依赖路径，转换为绝对路径
 */
function resolveDependency(importPath, fromFile, srcRoot, projectRoot) {
    // 跳过外部包和特殊路径
    if (importPath.startsWith('@/')) {
        // @/ 别名，指向 src/
        const relativePath = importPath.replace('@/', '');
        return path.join(srcRoot, relativePath);
    }
    
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
        // 相对路径
        const dir = path.dirname(fromFile);
        return path.resolve(dir, importPath);
    }
    
    // 外部包或特殊路径，返回 null
    return null;
}

/**
 * 查找可能的文件路径（支持扩展名推断）
 */
function findFile(filePath) {
    // 如果文件存在，直接返回
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return filePath;
    }
    
    // 尝试添加扩展名
    const extensions = ['.js', '.jsx', '.ts', '.tsx', '.less', '.css', '.json'];
    for (const ext of extensions) {
        const fileWithExt = filePath + ext;
        if (fs.existsSync(fileWithExt) && fs.statSync(fileWithExt).isFile()) {
            return fileWithExt;
        }
    }
    
    // 尝试作为目录的 index 文件
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        for (const ext of extensions) {
            const indexFile = path.join(filePath, `index${ext}`);
            if (fs.existsSync(indexFile)) {
                return indexFile;
            }
        }
    }
    
    return null;
}

/**
 * 将绝对路径转换为 @/ 格式（如果可能）
 */
function toAliasPath(filePath, srcRoot) {
    const relativePath = path.relative(srcRoot, filePath);
    if (!relativePath.startsWith('..')) {
        return `@/${relativePath.replace(/\\/g, '/')}`;
    }
    return filePath.replace(/\\/g, '/');
}

/**
 * 解析文件中的 import/require 语句
 */
function parseImports(filePath) {
    if (!fs.existsSync(filePath)) {
        return [];
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const imports = [];
    
    // 匹配 import 语句（包括动态 import）
    const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"]([^'"]+)['"]/g;
    // 匹配 require 语句
    const requireRegex = /require\s*\(['"]([^'"]+)['"]\)/g;
    // 匹配动态 import: import('...')
    const dynamicImportRegex = /import\s*\([^)]*['"]([^'"]+)['"]/g;
    // 匹配 lazy(() => import('...')) 模式（包括带注释的）
    // 这个正则可以匹配：
    // - lazy(() => import('...'))
    // - lazy(() => import(/* webpackChunkName: "xxx" */'...'))
    // - lazy(() => import(/* ... */'...'))
    // 使用更精确的匹配，避免贪婪匹配导致的问题
    const lazyImportRegex = /lazy\s*\(\s*\(\)\s*=>\s*import\s*\((?:\/\*[^*]*(?:\*(?!\/)[^*]*)*\*\/\s*)?['"]([^'"]+)['"]/g;
    
    let match;
    
    // 提取 import
    while ((match = importRegex.exec(content)) !== null) {
        imports.push(match[1]);
    }
    
    // 提取 require
    while ((match = requireRegex.exec(content)) !== null) {
        imports.push(match[1]);
    }
    
    // 提取动态 import
    while ((match = dynamicImportRegex.exec(content)) !== null) {
        imports.push(match[1]);
    }
    
    // 提取 lazy(() => import('...'))（包括带注释和不带注释的）
    // 重置正则的 lastIndex，避免全局正则的问题
    lazyImportRegex.lastIndex = 0;
    while ((match = lazyImportRegex.exec(content)) !== null) {
        // 优化后的正则只有一个捕获组，直接使用 match[1]
        if (match[1]) {
            imports.push(match[1]);
        }
        // 防止无限循环：如果匹配到空字符串，跳出循环
        if (match[0].length === 0) {
            break;
        }
    }
    
    return imports;
}

/**
 * 解析样式文件引用（@import, url()）
 */
function parseStyleImports(filePath) {
    if (!fs.existsSync(filePath)) {
        return [];
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const imports = [];
    
    // 匹配 @import
    const importRegex = /@import\s+['"]([^'"]+)['"]/g;
    // 匹配 url()
    const urlRegex = /url\s*\(['"]([^'"]+)['"]\)/g;
    
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
        imports.push(match[1]);
    }
    
    while ((match = urlRegex.exec(content)) !== null) {
        imports.push(match[1]);
    }
    
    return imports;
}

/**
 * 检测项目的 src 目录路径
 */
function detectSrcRoot(projectRoot) {
    const possibleSrcPaths = [
        path.join(projectRoot, 'src'),
        path.join(projectRoot, 'source'),
        path.join(projectRoot, 'lib'),
        projectRoot
    ];
    
    for (const srcPath of possibleSrcPaths) {
        if (fs.existsSync(srcPath) && fs.statSync(srcPath).isDirectory()) {
            return srcPath;
        }
    }
    
    // 如果找不到，返回 projectRoot
    return projectRoot;
}

module.exports = {
    resolveDependency,
    findFile,
    toAliasPath,
    parseImports,
    parseStyleImports,
    detectSrcRoot
};

