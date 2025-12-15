/**
 * 目录树可视化组件
 */
import React, {useState, useMemo} from 'react';
import {Input, Button, message} from 'antd';
import {SearchOutlined, CopyOutlined, ExpandOutlined, CompressOutlined} from '@ant-design/icons';
import PropTypes from 'prop-types';
import './index.less';

const DirectoryTreeView = ({treeString}) => {
    const [searchText, setSearchText] = useState('');
    const [expanded, setExpanded] = useState(true);

    // 高亮搜索文本
    const highlightedTree = useMemo(() => {
        if (!searchText.trim() || !treeString) {
            return treeString;
        }

        const regex = new RegExp(`(${searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return treeString
            .split('\n')
            .map(line => {
                if (line.match(regex)) {
                    return line.replace(regex, '<mark>$1</mark>');
                }
                return line;
            })
            .join('\n');
    }, [treeString, searchText]);

    // 复制目录树
    const handleCopy = () => {
        navigator.clipboard.writeText(treeString)
            .then(() => {
                message.success('目录树已复制到剪贴板');
            })
            .catch(() => {
                message.error('复制失败');
            });
    };

    return (
        <div className="directory-tree-view">
            <div className="toolbar">
                <Input
                    placeholder="搜索文件或目录..."
                    prefix={<SearchOutlined />}
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    allowClear
                />
                <div className="actions">
                    <Button
                        icon={expanded ? <CompressOutlined /> : <ExpandOutlined />}
                        onClick={() => setExpanded(!expanded)}
                    >
                        {expanded ? '折叠' : '展开'}
                    </Button>
                    <Button
                        icon={<CopyOutlined />}
                        onClick={handleCopy}
                    >
                        复制
                    </Button>
                </div>
            </div>
            <div className="tree-container">
                <pre
                    className="tree-content"
                    dangerouslySetInnerHTML={{__html: highlightedTree}}
                />
            </div>
        </div>
    );
};

DirectoryTreeView.propTypes = {
    treeString: PropTypes.string.isRequired
};

export default DirectoryTreeView;

