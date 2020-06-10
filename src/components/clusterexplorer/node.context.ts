import * as vscode from 'vscode';
import * as path from 'path';

import { Kubectl } from '../../kubectl';
import * as kuberesources from '../../kuberesources';
import * as kubectlUtils from '../../kubectlUtils';
import { Host } from '../../host';
import { ClusterExplorerNode, ClusterExplorerNodeImpl, ClusterExplorerContextNode } from './node';
import { HelmReleasesFolder } from "./node.folder.helmreleases";
import { CRDTypesFolderNode } from "./node.folder.crdtypes";
import { workloadsGroupingFolder, networkGroupingFolder, storageGroupingFolder, configurationGroupingFolder } from "./node.folder.grouping";
import { ResourceFolderNode } from './node.folder.resource';
import { NODE_TYPES } from './explorer';

const KUBERNETES_CLUSTER = "vsKubernetes.cluster";
const MINIKUBE_CLUSTER = "vsKubernetes.minikubeCluster";

export class ContextNode extends ClusterExplorerNodeImpl implements ClusterExplorerContextNode {
    constructor(readonly contextName: string, readonly kubectlContext: kubectlUtils.KubectlContext) {
        super(NODE_TYPES.context);
    }
    readonly nodeType = NODE_TYPES.context;
    get icon(): vscode.Uri {
        return vscode.Uri.file(path.join(__dirname, "../../../../images/k8s-logo.png"));
    }
    get clusterType(): string {
        return KUBERNETES_CLUSTER;
    }
    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
        if (this.kubectlContext.active) {
            return [
                ResourceFolderNode.create(kuberesources.allKinds.namespace),
                ResourceFolderNode.create(kuberesources.allKinds.node),
                workloadsGroupingFolder(),
                networkGroupingFolder(),
                storageGroupingFolder(),
                configurationGroupingFolder(),
                new CRDTypesFolderNode(),
                new HelmReleasesFolder(),
            ];
        }
        return [];
    }
    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        let label = this.contextName;
        if (this.kubectlContext) {
            const namespace = this.kubectlContext.namespace ? this.kubectlContext.namespace : '';
            label = `${namespace}/${this.kubectlContext.clusterName}/${this.kubectlContext.userName.split('/')[0]}`;
        } 
        const treeItem = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed);
        treeItem.contextValue = this.clusterType;
        treeItem.iconPath = this.icon;
        if (!this.kubectlContext || !this.kubectlContext.active) {
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
            treeItem.contextValue += ".inactive";
        }
        if (this.kubectlContext) {
            treeItem.tooltip = `${this.kubectlContext.contextName}\nCluster: ${this.kubectlContext.clusterName}`;
        }
        return treeItem;
    }
    async apiURI(_kubectl: Kubectl, _namespace: string): Promise<string | undefined> {
        return undefined;
    }
}
export class MiniKubeContextNode extends ContextNode {
    get icon(): vscode.Uri {
        return vscode.Uri.file(path.join(__dirname, "../../../../images/minikube-logo.png"));
    }
    get clusterType(): string {
        return MINIKUBE_CLUSTER;
    }
}
