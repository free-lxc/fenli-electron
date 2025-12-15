/**
 * 目录树展示组件（只显示文件夹）
 */
import React, {useState} from 'react';
import {Tree, Empty, Button} from 'antd';
import {FolderOutlined, FolderOpenOutlined} from '@ant-design/icons';
import PropTypes from 'prop-types';
import './index.less';

const DirectoryTree = ({directoryTree = null, projectRoot = ''}) => {
    const [expandedKeys, setExpandedKeys] = useState([]);

    if (!directoryTree) {
        return <Empty description="暂无目录结构信息" />;
    }

    // 将目录树转换为 Ant Design Tree 组件需要的数据格式
    const convertToTreeData = node => {
        if (!node) {
            return [];
        }

        const treeData = {
            title: (
                <span className="tree-node-title">
                    {expandedKeys.includes(node.path)
                        ? (
                            <FolderOpenOutlined className="folder-icon" />
                        )
                        : (
                            <FolderOutlined className="folder-icon" />
                        )}
                    <span className="folder-name">
                        {node.name}
                    </span>
                </span>
            ),
            key: node.path,
            isLeaf: node.children.length === 0,
            children: node.children.length > 0
                ? node.children.map(convertToTreeData)
                : null
        };

        return treeData;
    };

    const treeData = [convertToTreeData(directoryTree)];

    // 展开所有节点
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

    // 折叠所有节点
    const handleCollapseAll = () => {
        setExpandedKeys([]);
    };

    return (
        <div className="directory-tree-container">
            <div className="tree-header">
                <div className="tree-title">
                    <span>项目目录结构</span>
                    {projectRoot && (
                        <span className="project-root">
                            根目录:
                            {' '}
                            {projectRoot}
                        </span>
                    )}
                </div>
                <div className="tree-actions">
                    <Button type="link" onClick={handleExpandAll}>
                        展开全部
                    </Button>
                    <Button type="link" onClick={handleCollapseAll}>
                        折叠全部
                    </Button>
                </div>
            </div>
            <div className="tree-content">
                <Tree
                    treeData={treeData}
                    expandedKeys={expandedKeys}
                    onExpand={setExpandedKeys}
                    showLine
                    defaultExpandAll={false}
                />
            </div>
        </div>
    );
};

// 递归结构定义
const treeNodeShape = PropTypes.shape({
    name: PropTypes.string,
    path: PropTypes.string,
    children: PropTypes.arrayOf(PropTypes.object)
});

// 使用默认参数替代 defaultProps（React 推荐方式）
DirectoryTree.propTypes = {
    directoryTree: treeNodeShape,
    projectRoot: PropTypes.string
};

export default DirectoryTree;

