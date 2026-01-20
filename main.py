import sys
import os
import json
import torch
from PyQt5.QtWidgets import QApplication, QMainWindow
from PyQt5.QtWebEngineWidgets import QWebEngineView
from PyQt5.QtWebChannel import QWebChannel
from PyQt5.QtCore import QObject, pyqtSlot, QUrl
from Model import create_graph, create_model, execute
from LLmDataset import LLMprepare,TokenDataset
from Optimzers import get_optim
from Training import train_model

class Backend(QObject):
    @pyqtSlot(str, result=str)
    def __init__(self, parent = ...):
        super().__init__(parent)
        self.DatasetObject = None
        self.Optimizer = None
        self.ip = None
        self.op = None
        self.NodesList = None
        self.execution_order = None
    def LLMdataset(self,fname):
        try:
            json_data = json.loads(fname)
            # call the objects and all
            fname = json_data["fname"]
            context_len = json_data["context_len"]
            token_f_name,leng = LLMprepare(fname)
            self.DatasetObject = TokenDataset(token_f_name, leng= leng,context_length=context_len)

        except Exception as e:
            return json.dumps({
                "status": "error",
                "message": str(e)
            })


    def Optmizer(self,type_o,lr):
        self.Optimizer = get_optim(type_o,lr)
    
    def train(self,train_attributes):
        # build dataloader
        # write ip and op of data loader
        # use execute with NodeList and execution order
        train_model(self.DatasetObject,self.NodesList,self.execution_order,self.Optimizer,train_attributes)
        


    def analyze(self, json_str):
        try:
            json_data = json.loads(json_str)
            print("RECEIVED:", json_data)

            NodesList, adjacency_matrix = create_graph(json_data)
            execution_order = create_model(adjacency_matrix, NodesList)
            self.NodesList = NodesList
            self.execution_order = execution_order
            ip = torch.rand(2, 3, 128, 68)
            op = execute(execution_order, NodesList, ip)

            return json.dumps({
                "status": "ok",
                "shape": list(op.shape)
            })

        except Exception as e:
            return json.dumps({
                "status": "error",
                "message": str(e)
            })


class DeepLabApp(QMainWindow):
    def __init__(self):
        super().__init__()

        self.setWindowTitle("DeepLab")
        self.setGeometry(100, 100, 1200, 800)

        self.browser = QWebEngineView()
        self.setCentralWidget(self.browser)

        # WebChannel
        self.backend = Backend()
        self.channel = QWebChannel()
        self.channel.registerObject("backend", self.backend)
        self.browser.page().setWebChannel(self.channel)

        # Load HTML
        base_dir = os.path.dirname(os.path.abspath(__file__))
        html_path = os.path.join(base_dir, "web", "index.html")
        self.browser.load(QUrl.fromLocalFile(html_path))


if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = DeepLabApp()
    window.show()
    sys.exit(app.exec_())
