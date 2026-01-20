from torch.utils.data import Dataset, DataLoader
from Model import execute
import torch.nn as nn
def train_model(DatasetObject,NodesList,execution_order,Optimizer_cus,train_attributes):
    dataloader = DataLoader(
    DatasetObject,
    batch_size=train_attributes["batch_size"],
    shuffle=True,
    num_workers=0
    )
    optimizer = Optimizer_cus
    num_epochs = 10
    criterion = nn.CrossEntropyLoss()


    for epoch in range(num_epochs):
        # model.train()
        total_loss = 0
        
        for batch_idx, (inputs, targets) in enumerate(dataloader):
            # Move to device
            ip = inputs
            outputs = execute(execution_order,NodesList,ip)
            targets = targets
            
            # Forward pass
            
            # Reshape for loss calculation
            loss = criterion(
                outputs.view(-1, vocab_size),  # (batch_size * seq_len, vocab_size)
                targets.view(-1)                # (batch_size * seq_len)
            )
            
            # Backward pass
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            
            total_loss += loss.item()
        
        # Print epoch loss
        avg_loss = total_loss / len(dataloader)
        print(f"Epoch {epoch + 1}/{num_epochs} | Loss: {avg_loss:.4f}")

    print("\nTraining complete!")

