"""Run after `forge build --root contracts`; public RPC reads only; no env/key access.
From repository root: python3 docs/evidence/2026-10-17/independent-1807/compare-versions.py
Immutable masks come from the LOCAL artifact; differing layouts are not equivalent.
A matching result masks immutable VALUES, so it is not full deployment verification.
"""
from pathlib import Path
import json, subprocess
root=Path(__file__).resolve().parents[4]
manifest=json.loads((root/'contracts/deployments/fuji.json').read_text())
rpc='https://api.avax-test.network/ext/bc/C/rpc'
for name,key in [('RoundFactory','roundFactory'),('StudentRegistry','studentRegistry'),('MockUSDC','mockUsdc')]:
    artifact=json.loads((root/'contracts/out'/f'{name}.sol'/f'{name}.json').read_text())
    local=bytes.fromhex(artifact['deployedBytecode']['object'].removeprefix('0x'))
    remote=bytes.fromhex(subprocess.check_output(['cast','code',manifest[key],'--rpc-url',rpc],text=True).strip().removeprefix('0x'))
    refs=[x for xs in artifact['deployedBytecode'].get('immutableReferences',{}).values() for x in xs]
    def normalize(code):
        result=bytearray(code)
        for ref in refs:
            start,size=ref['start'],ref['length']
            if start+size<=len(result): result[start:start+size]=bytes(size)
        size=int.from_bytes(result[-2:],'big')
        return bytes(result[:-size-2]) if size+2<len(result) else bytes(result)
    print(name, 'local bytes=',len(local),'Fuji bytes=',len(remote),'executable match, immutables masked=',normalize(local)==normalize(remote))
