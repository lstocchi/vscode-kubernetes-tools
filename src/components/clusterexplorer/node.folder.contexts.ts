import * as vscode from 'vscode';
import { Kubectl } from '../../kubectl';
import { Host } from '../../host';
import * as kubectlUtils from '../../kubectlUtils';
import { ClusterExplorerNode, ClusterExplorerCustomNode, ClusterExplorerNodeImpl } from './node';
import { MessageNode } from './node.message';
import { NODE_TYPES } from './explorer';
import * as providerResult from '../../utils/providerresult';

export class ContextsFolderNode extends ClusterExplorerNodeImpl implements ClusterExplorerCustomNode {
    constructor(readonly kubectlContext: kubectlUtils.KubectlContext) {
        super(NODE_TYPES.extension);
    }
    readonly nodeType = NODE_TYPES.extension;

    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
        const contexts = kubectlUtils.getContexts(_kubectl, { silent: false });  // TODO: turn it silent, cascade errors, and provide an error node
        return providerResult.map(contexts, (ti) => {
            if (!ti.active) {
                return new MessageNode(ti.contextName);
            }
            return new MessageNode('ii');
        });
    }

    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return new vscode.TreeItem('Contexts', vscode.TreeItemCollapsibleState.Collapsed);
    }

    async apiURI(_kubectl: Kubectl, _namespace: string): Promise<string | undefined> {
        return undefined;
    }
}
