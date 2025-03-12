# encrypt_test.py
from Crypto.Cipher import AES
from Crypto.Util import Counter
import hashlib
from datetime import datetime

KEY = b"KeiPybAras\x00\x00\x00\x00\x00"
print(f"Key length: {len(KEY)} bytes")

def encryption(plaintext, timestamp_str):
    timestamp_ms = int(datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S.%f").timestamp() * 1000)
    ts = hashlib.md5(timestamp_ms.to_bytes(16, 'big')).digest()
    c = Counter.new(128)
    cipher = AES.new(KEY, AES.MODE_CTR, counter=c)
    # Pad to next 32-byte boundary (or fixed 128 bytes)
    target_length = 128  # Match output.txt
    padding_length = target_length - len(plaintext) if len(plaintext) < target_length else (16 - len(plaintext) % 16) % 16
    padded_plaintext = plaintext + b'\x00' * padding_length
    ciphertext = cipher.encrypt(padded_plaintext)
    ciphertext_blocks = [ciphertext[i:i+16] for i in range(0, len(ciphertext), 16)]
    ciphertext_with_xor = b''
    for block in ciphertext_blocks:
        block_with_xor = bytes(a ^ b for a, b in zip(block, ts))
        ciphertext_with_xor += block_with_xor
    return ciphertext_with_xor.hex()

test = b"Capybara friends, mission accomplished! We've caused a blackout, let's meet at the bar to celebrate!"
timestamp = "2025-03-10 09:50:07.974000"
cipher = encryption(test, timestamp)
print(f"Test length: {len(test)} bytes")
print(f"Cipher length: {len(cipher)} hex chars ({len(cipher)//2} bytes)")
print(f"Cipher: {cipher}")