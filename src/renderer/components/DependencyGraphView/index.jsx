/**
 * 依赖关系图可视化组件
 */
import React, {useState, useMemo} from 'react';
import {Input, Button, message, Tree, Tag, Empty} from 'antd';
import {SearchOutlined, CopyOutlined, NodeIndexOutlined} from '@ant-design/icons';
import PropTypes from 'prop-types';
import './index.less';

const {Search} = Input;

const DependencyGraphView = ({dependencyGraph = {}}) => {
    const [searchText, setSearchText] = useState('');
    const [expandedKeys, setExpandedKeys] = useState([]);
    const [selectedKeys, setSelectedKeys] = useState([]);

    // 构建树形数据
    const treeData = useMemo(() => {
        if (!dependencyGraph) {
            return [];
        }

        // 限制深度避免性能问题
        const MAX_DEPTH = 5;
        // 限制显示数量
        const MAX_DISPLAY = 50;
        // 用于生成唯一 key 的计数器
        let keyCounter = 0;
        // 用于跟踪已访问的节点，避免无限循环
        const visitedPaths = new Set();

        const buildTree = (filePath, deps, level = 0, parentKey = '') => {
            if (level > MAX_DEPTH) {
                return null;
            }

            // 生成唯一 key：使用路径 + 父路径 + 计数器
            const uniqueKey = `${parentKey}::${filePath}::${keyCounter++}`;

            // 检查是否已经访问过（避免循环依赖导致的无限递归）
            const pathKey = `${parentKey}::${filePath}`;
            if (visitedPaths.has(pathKey)) {
                return null;
            }
            visitedPaths.add(pathKey);

            const children = deps
                .filter(dep => {
                    if (!searchText) {
                        return true;
                    }
                    return dep.toLowerCase().includes(searchText.toLowerCase())
                           || filePath.toLowerCase().includes(searchText.toLowerCase());
                })
                .map(dep => {
                    const childDeps = dependencyGraph[dep] || [];
                    return buildTree(dep, childDeps, level + 1, uniqueKey);
                })
                .filter(Boolean);

            return {
                title: (
                    <span>
                        <NodeIndexOutlined className="icon" />
                        <span className="file-name">
                            {filePath}
                        </span>
                        {deps.length > 0 && (
                            <Tag color="blue" className="dep-tag">
                                {`${deps.length} 个依赖`}
                            </Tag>
                        )}
                    </span>
                ),
                key: uniqueKey,
                // 保存原始路径用于显示
                filePath,
                children: children.length > 0 ? children : null,
                isLeaf: deps.length === 0
            };
        };

        // 只显示有依赖的文件作为根节点
        const rootFiles = Object.keys(dependencyGraph).filter(
            file => dependencyGraph[file] && dependencyGraph[file].length > 0
        );

        // 重置访问集合和计数器
        visitedPaths.clear();
        keyCounter = 0;

        return rootFiles
            .filter(file => {
                if (!searchText) {
                    return true;
                }
                return file.toLowerCase().includes(searchText.toLowerCase());
            })
            .slice(0, MAX_DISPLAY)
            .map(file => {
                // 为每个根节点重置访问集合
                visitedPaths.clear();
                return buildTree(file, dependencyGraph[file] || [], 0, 'root');
            })
            .filter(Boolean);
    }, [dependencyGraph, searchText]);

    // 复制JSON
    const handleCopyJson = () => {
        navigator.clipboard.writeText(JSON.stringify(dependencyGraph, null, 2))
            .then(() => {
                message.success('依赖关系图已复制到剪贴板');
            })
            .catch(() => {
                message.error('复制失败');
            });
    };

    // 展开所有
    const handleExpandAll = () => {
        const getAllKeys = nodes => {
            let keys = [];
            nodes.forEach(node => {
                keys.push(node.key);
                if (node.children) {
                    keys = keys.concat(getAllKeys(node.children));
                }
            });
            return keys;
        };
        setExpandedKeys(getAllKeys(treeData));
    };

    // 折叠所有
    const handleCollapseAll = () => {
        setExpandedKeys([]);
    };

    if (!dependencyGraph || Object.keys(dependencyGraph).length === 0) {
        return <Empty description="暂无依赖关系数据" />;
    }

    const totalFiles = Object.keys(dependencyGraph).length;
    const totalDeps = Object.values(dependencyGraph).reduce(
        (sum, deps) => sum + (deps?.length || 0),
        0
    );

    return (
        <div className="dependency-graph-view">
            <div className="toolbar">
                <Search
                    placeholder="搜索文件..."
                    prefix={<SearchOutlined />}
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    allowClear
                />
                <div className="actions">
                    <Button onClick={handleExpandAll}>展开全部</Button>
                    <Button onClick={handleCollapseAll}>折叠全部</Button>
                    <Button icon={<CopyOutlined />} onClick={handleCopyJson}>
                        复制JSON
                    </Button>
                </div>
            </div>
            <div className="tree-container">
                <Tree
                    treeData={treeData}
                    expandedKeys={expandedKeys}
                    selectedKeys={selectedKeys}
                    onExpand={setExpandedKeys}
                    onSelect={setSelectedKeys}
                    showLine
                    defaultExpandAll={false}
                />
            </div>
            <div className="stats">
                <Tag>
                    {`共 ${totalFiles} 个文件`}
                </Tag>
                <Tag>
                    {`共 ${totalDeps} 个依赖关系`}
                </Tag>
            </div>
        </div>
    );
};

// 使用默认参数替代 defaultProps（React 推荐方式）
DependencyGraphView.propTypes = {
    dependencyGraph: PropTypes.objectOf(PropTypes.arrayOf(PropTypes.string))
};

export default DependencyGraphView;

