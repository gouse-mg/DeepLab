import torch
import torch.nn as nn
import json
from collections import deque

class UserDefined(nn.Module):
    def __init__(self, features):
        super().__init__()
        self.features = features   # user-supplied code string
        # self.node_index = node_index

    def forward(self, *args):
        usercode,n_ips = self.features[0],self.features[1]
        ns = {
            "args": args,
            "torch": torch
        }
        # Pass ns as both globals AND locals, or just use it as globals
        exec(usercode, ns, ns)
        return ns.get("op")
    

def makeLinear(features):
    in_features, out_features, bias = features[0],features[1],features[2]
    return nn.Linear(in_features, out_features, bias)

def makeConv(features):
    in_channels, out_channels, kernel_size, stride, padding = features[0],features[1],features[2],features[3],features[4]
    return nn.Conv2d(in_channels, out_channels, kernel_size, stride, padding)
def create_user_defined(feautures):
    obj = UserDefined(feautures)
    return obj
def make_ip(features):
    return None

function_list = {
    0:make_ip,
    1: makeLinear,
    2: makeConv,
    3:create_user_defined
}

class Node:
    def __init__(self, module_object=None,user_def=False,IpNode=False):
        self.module_object = module_object
        self.parentlist = []
        self.op = None
        self.user_def = user_def
        self.ip_node = IpNode
    def run(self,x):
        return self.module_object(x)
    


def create_model(adj, NodesList):
    """
    Takes adjacency matrix and NodesList, populates parent lists,
    and returns topological order of node IDs.
    
    Args:
        adj: 2D list where adj[i][j] = 1 means edge from node i to node j
        NodesList: dict of {node_id: NodeObject}
    
    Returns:
        List of node_ids in topological order
    """
    # First, populate parent lists for each node
    node_ids = list(NodesList.keys())
    n = len(node_ids)
    
    # Create mapping from index to node_id
    index_to_id = {i: node_ids[i] for i in range(n)}
    id_to_index = {node_ids[i]: i for i in range(n)}
    
    # Populate parent lists
    for i in range(n):
        for j in range(n):
            if adj[i][j] == 1:  # Edge from i to j
                src_id = index_to_id[i]
                dest_id = index_to_id[j]
                # Append parent node object to destination's parent list
                NodesList[dest_id].parentlist.append(NodesList[src_id])
    
    # Calculate in-degrees
    in_degree = [0] * n
    for i in range(n):
        for j in range(n):
            if adj[i][j] == 1:
                in_degree[j] += 1
    
    # Initialize queue with nodes having in-degree 0
    queue = deque()
    for i in range(n):
        if in_degree[i] == 0:
            queue.append(i)
    
    topo_order = []
    
    # Kahn's algorithm for topological sort
    while queue:
        current_idx = queue.popleft()
        current_id = index_to_id[current_idx]
        topo_order.append(current_id)
        
        # Reduce in-degree for neighbors
        for j in range(n):
            if adj[current_idx][j] == 1:
                in_degree[j] -= 1
                if in_degree[j] == 0:
                    queue.append(j)
    
    # Check if there was a cycle
    if len(topo_order) != n:
        raise Exception("Graph has a cycle! Cannot perform topological sort.")
    
    return topo_order
def create_graph(json_data):
    NodesList = {}
    for node_id, node_data in json_data['Nodes'].items():
        module_index = node_data['module_index']
        user_defined = node_data['user-defined']
        ip_node = node_data['IpNode']
        features = node_data['features']
        features = tuple(features)
        
        # Get the function from function_list
        create_function = function_list[int(module_index)]
        
        # Create the PyTorch module (for Conv2d, we need kernel_size too)
        # print(features)
        module_object = create_function(features)
        
        # Create Node with the module object
        NodesList[int(node_id)] = Node(module_object,user_def = user_defined,IpNode=ip_node)
        num_nodes = len(NodesList)
    node_ids = list(NodesList.keys())
    node_id_to_index = {node_id: i for i, node_id in enumerate(node_ids)}

    # Initialize adjacency matrix with zeros
    adjacency_matrix = [[0 for _ in range(num_nodes)] for _ in range(num_nodes)]

    # Fill adjacency matrix based on edges
    for edge in json_data['Edges']:
        src = int(edge['src'])
        dest = int(edge['dest'])
        
        src_index = node_id_to_index[src]
        dest_index = node_id_to_index[dest]
        
        adjacency_matrix[src_index][dest_index] = 1  # src->dest
        
        # Also update parentlist
        # NodesList[dest].parentlist.append(src)
    return NodesList,adjacency_matrix
# Node

def execute(execution_order,NodesList,ip):
    final_op = None
    for node_id in execution_order:
        node = NodesList[node_id]
        # print
        if node.ip_node:
            node.op = ip
            final_op = node.op
            # print("ip",ip.shape)

            print("this")
            pass
        elif not node.user_def:
            print("that")
            parent = node.parentlist[0]
            
            if parent.op is None:
                raise RuntimeError(f"Parent of node {node_id} has no output yet")
            ip = parent.op
            print("ip",ip.shape)

            # print(ip.shape,node.module_object)
            node.op = node.run(ip)
            final_op = node.op
            
        elif node.user_def:
            print("them")
            ips = []
            for n in node.parentlist:
                ips.append(n.op)
                print("ip",n.op.shape)
            node.op = node.module_object(*ips)
            final_op = node.op
        print(final_op.shape)
    return final_op