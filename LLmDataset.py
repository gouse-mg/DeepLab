import torch
from torch.utils.data import Dataset, DataLoader
import numpy as np
from transformers import AutoTokenizer
import os


def LLMprepare(fname):
    tokenizer = AutoTokenizer.from_pretrained("gpt2")

# ============ APPROACH 1: Memory-mapped (RECOMMENDED) ============
    initial_size = 10_000_000
    mmap_file = "tokenized.npy"

    tokens_mmap = np.memmap(mmap_file, dtype=np.int32, mode='w+', shape=(initial_size,))
    write_idx = 0  # This tracks position - ensures sequential writing

    with open(fname, "r", encoding="utf-8") as fin:
        for line in fin:
            ids = tokenizer.encode(line, add_special_tokens=False)
            
            if ids:
                num_tokens = len(ids)
                
                # Expand if needed
                if write_idx + num_tokens > tokens_mmap.shape[0]:
                    tokens_mmap.flush()
                    new_size = tokens_mmap.shape[0] * 2
                    tokens_mmap = np.memmap(mmap_file, dtype=np.int32, mode='r+', shape=(new_size,))
                
                # Sequential write: write_idx ensures order
                tokens_mmap[write_idx:write_idx + num_tokens] = ids
                write_idx += num_tokens  # Move position forward
                
                if write_idx % 100_000 == 0:
                    tokens_mmap.flush()

    tokens_mmap.flush()
    return "tokenized.npy",write_idx

import numpy as np
class TokenDataset:
    """Memory-mapped token dataset for efficient random access"""
    
    def __init__(self, mmap_file, leng,context_length=512):
        """
        Args:
            mmap_file: Path to the .npy memory-mapped file
            context_length: Number of tokens to load per sample
        """
        self.mmap_file = mmap_file
        self.context_length = context_length
        
        # Open as memory-mapped array (doesn't load into RAM)
        self.tokens = np.memmap(mmap_file, dtype=np.int32, mode='r')
        self.total_tokens = leng
        
    def __len__(self):
        """Number of possible windows"""
        return max(0, self.total_tokens - self.context_length)
    
    def __getitem__(self, idx):
        """
        Load tokens starting from idx with length context_length
        
        Args:
            idx: Starting index
            
        Returns:
            numpy array of shape (context_length,)
        """
        if idx < 0 or idx + self.context_length > self.total_tokens:
            raise IndexError(f"Index {idx} out of range for dataset of size {self.total_tokens}")
        
        tokens = self.tokens[idx:idx + self.context_length+1]
        chunk = np.array(tokens)
        
        x = torch.from_numpy(chunk[:-1]).long()
        y = torch.from_numpy(chunk[1:]).long()
        
        return x, y
