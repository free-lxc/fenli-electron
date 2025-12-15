/**
 * 目录树生成模块
 * 根据依赖关系生成目录树结构
 */

const path = require('path');

/**
 * 构建目录树节点
 */
class TreeNode {
    constructor(name, fullPath) {
        this.name = name;
        this.fullPath = fullPath;
        this.children = new Map();
        this.files = [];
    }
}

/**
 * 构建目录树
 */
function buildDirectoryTree(dependencies, rootName = 'src', srcRoot = '') {
    const root = new TreeNode(rootName, rootName);
    
    // 获取所有文件路径
    const allFiles = new Set();
    Object.keys(dependencies).forEach(file => {
        allFiles.add(file);
        if (Array.isArray(dependencies[file])) {
            dependencies[file].forEach(dep => {
                allFiles.add(dep);
            });
        }
    });
    
    // 按路径排序
    const sortedFiles = Array.from(allFiles).sort();
    
    // 构建树结构
    sortedFiles.forEach(filePath => {
        // 移除 @/ 前缀或其他前缀
        let relativePath = filePath;
        if (relativePath.startsWith('@/')) {
            relativePath = relativePath.replace(/^@\//, '');
        } else if (relativePath.startsWith('./')) {
            relativePath = relativePath.replace(/^\.\//, '');
        }
        
        const parts = relativePath.split('/').filter(p => p);
        
        if (parts.length === 0) {
            return;
        }
        
        let current = root;
        let currentPath = rootName;
        
        // 遍历路径的每一部分
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isLast = i === parts.length - 1;
            currentPath = path.join(currentPath, part);
            
            if (isLast) {
                // 最后一部分是文件
                const depCount = Array.isArray(dependencies[filePath]) 
                    ? dependencies[filePath].length 
                    : 0;
                current.files.push({
                    name: part,
                    fullPath: filePath,
                    dependencies: dependencies[filePath] || [],
                    depCount
                });
            } else {
                // 中间部分是目录
                if (!current.children.has(part)) {
                    current.children.set(part, new TreeNode(part, currentPath));
                }
                current = current.children.get(part);
            }
        }
    });
    
    return root;
}

/**
 * 生成目录树字符串
 */
function generateTreeString(node, options = {}) {
    const {
        prefix = '',
        isLast = true,
        maxDepth = 10,
        currentDepth = 0,
        showDeps = true
    } = options;

    if (currentDepth > maxDepth) {
        return '';
    }
    
    const lines = [];
    const connector = isLast ? '└── ' : '├── ';
    const nextPrefix = isLast ? '    ' : '│   ';
    
    // 输出目录名
    if (currentDepth > 0) {
        lines.push(prefix + connector + node.name + '/');
    } else {
        lines.push(node.name + '/');
    }
    
    // 处理子目录
    const childEntries = Array.from(node.children.entries()).sort((a, b) => {
        // 目录优先，然后按名称排序
        const aIsDir = a[1].children.size > 0 || a[1].files.length > 0;
        const bIsDir = b[1].children.size > 0 || b[1].files.length > 0;
        if (aIsDir !== bIsDir) {
            return aIsDir ? -1 : 1;
        }
        return a[0].localeCompare(b[0]);
    });
    
    childEntries.forEach(([name, child], index) => {
        const isLastChild = index === childEntries.length - 1 && node.files.length === 0;
        const childPrefix = currentDepth > 0 ? prefix + nextPrefix : '';
        const childLines = generateTreeString(child, {
            prefix: childPrefix,
            isLast: isLastChild,
            maxDepth,
            currentDepth: currentDepth + 1,
            showDeps
        });
        if (childLines) {
            lines.push(...childLines.split('\n').filter(l => l));
        }
    });
    
    // 处理文件
    const sortedFiles = node.files.sort((a, b) => a.name.localeCompare(b.name));
    sortedFiles.forEach((file, index) => {
        const isLastFile = index === sortedFiles.length - 1;
        const fileConnector = (childEntries.length === 0 && isLastFile) || 
                             (childEntries.length > 0 && isLastFile) ? '└── ' : '├── ';
        const filePrefix = currentDepth > 0 ? prefix + nextPrefix : '';
        let fileInfo = file.name;
        
        if (showDeps && file.depCount > 0) {
            fileInfo += ` (${file.depCount} 个依赖)`;
        }
        
        lines.push(filePrefix + fileConnector + fileInfo);
    });
    
    return lines.join('\n');
}

module.exports = {
    TreeNode,
    buildDirectoryTree,
    generateTreeString
};

