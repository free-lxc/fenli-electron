/**
 * Markdown 生成模块
 * 将依赖图和目录树生成 Markdown 文档
 */

/**
 * 生成完整的 Markdown 文档
 */
function generateMarkdown(options) {
    const {
        entryFile,
        dependencyGraph,
        directoryTree,
        statistics,
        title = '依赖关系图'
    } = options;

    const lines = [];
    
    // 标题
    lines.push(`# ${title}`);
    lines.push('');
    
    // 入口文件信息
    if (entryFile) {
        lines.push(`**入口文件：** \`${entryFile}\``);
        lines.push('');
    }
    
    // 统计信息
    if (statistics) {
        lines.push('## 统计信息');
        lines.push('');
        lines.push(`- **总文件数**: ${statistics.totalFiles}`);
        lines.push(`- **总依赖数**: ${statistics.totalDependencies}`);
        lines.push('');
        lines.push('### 文件类型分布');
        lines.push('');
        Object.entries(statistics.filesByType).forEach(([type, count]) => {
            if (count > 0) {
                lines.push(`- **${type}**: ${count} 个文件`);
            }
        });
        lines.push('');
    }
    
    // 文件目录结构
    if (directoryTree) {
        lines.push('## 文件目录结构');
        lines.push('');
        lines.push('```');
        lines.push(directoryTree);
        lines.push('```');
        lines.push('');
    }
    
    // 依赖关系
    if (dependencyGraph) {
        lines.push('## 依赖关系');
        lines.push('');
        lines.push('```json');
        lines.push(JSON.stringify(dependencyGraph, null, 2));
        lines.push('```');
        lines.push('');
    }
    
    // 文件列表
    if (dependencyGraph) {
        lines.push('## 文件列表');
        lines.push('');
        const fileCount = Object.keys(dependencyGraph).length;
        lines.push(`共追踪到 **${fileCount}** 个文件：`);
        lines.push('');
        
        // 按类型分组
        const filesByType = {
            'JavaScript': [],
            'TypeScript': [],
            '样式文件': [],
            '配置文件': [],
            '其他': []
        };
        
        const sortedFiles = Object.keys(dependencyGraph).sort();
        sortedFiles.forEach(file => {
            const ext = file.match(/\.(\w+)$/)?.[1] || '';
            const deps = dependencyGraph[file] || [];
            
            const fileInfo = {
                path: file,
                deps: deps
            };
            
            if (['js', 'jsx'].includes(ext)) {
                filesByType['JavaScript'].push(fileInfo);
            } else if (['ts', 'tsx'].includes(ext)) {
                filesByType['TypeScript'].push(fileInfo);
            } else if (['less', 'css'].includes(ext)) {
                filesByType['样式文件'].push(fileInfo);
            } else if (['json'].includes(ext)) {
                filesByType['配置文件'].push(fileInfo);
            } else {
                filesByType['其他'].push(fileInfo);
            }
        });
        
        // 输出各类型文件
        Object.keys(filesByType).forEach(type => {
            const files = filesByType[type];
            if (files.length > 0) {
                lines.push(`### ${type} (${files.length})`);
                lines.push('');
                files.forEach(file => {
                    lines.push(`- **${file.path}**`);
                    if (file.deps.length > 0) {
                        lines.push(`  - 依赖：${file.deps.map(d => `\`${d}\``).join(', ')}`);
                    } else {
                        lines.push(`  - 无依赖`);
                    }
                    lines.push('');
                });
            }
        });
    }
    
    return lines.join('\n');
}

/**
 * 更新现有 Markdown 文件
 */
function updateMarkdownFile(filePath, newContent) {
    const fs = require('fs');
    
    if (!fs.existsSync(filePath)) {
        // 如果文件不存在，直接写入新内容
        fs.writeFileSync(filePath, newContent, 'utf-8');
        return;
    }
    
    // 如果文件存在，可以选择替换或追加
    // 这里我们选择替换整个文件
    fs.writeFileSync(filePath, newContent, 'utf-8');
}

module.exports = {
    generateMarkdown,
    updateMarkdownFile
};

