# decrypt.py
from Crypto.Cipher import AES
from Crypto.Util import Counter
import hashlib
from datetime import datetime

KEY = b"KeiPybAras\x00\x00\x00\x00\x00"
print(f"Key length: {len(KEY)} bytes")

def decryption(ciphertext_hex, timestamp_str):
    ts = hashlib.md5(int(datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S.%f").timestamp() * 1000).to_bytes(16, 'big')).digest()
    ciphertext = bytes.fromhex(ciphertext_hex)
    blocks = [ciphertext[i:i+16] for i in range(0, len(ciphertext), 16)]
    decrypted_xor = b''
    for block in blocks:
        decrypted_xor += bytes(a ^ b for a, b in zip(block, ts[:len(block)]))
    c = Counter.new(128)
    cipher = AES.new(KEY, AES.MODE_CTR, counter=c)
    plaintext = cipher.decrypt(decrypted_xor)
    return plaintext.rstrip(b'\x00')

with open('output.txt', 'r') as f:
    lines = f.readlines()

test_date, test_cipher = lines[0].split()
flag_date, flag_cipher = lines[1].split()

test_plain = decryption(test_cipher, test_date)
flag_plain = decryption(flag_cipher, flag_date)

print("Decrypted Test Message:", test_plain.decode('utf-8', errors='ignore'))
print("Decrypted Flag:", flag_plain.decode('utf-8', errors='ignore'))