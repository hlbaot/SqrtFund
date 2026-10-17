"""Read-only public Fuji verification. Run from repository root after forge build."""
import concurrent.futures
import json
import subprocess

RPC = "https://api.avax-test.network/ext/bc/C/rpc"
manifest = json.loads(open("contracts/deployments/fuji.json").read())
def cast(*args):
    return subprocess.check_output(["cast", *args], text=True).strip()
block = cast("block-number", "--rpc-url", RPC)
def call(address, signature):
    return cast("call", address, signature, "--block", block, "--rpc-url", RPC)
def check(key):
    name = {"mockUsdc": "MockUSDC", "roundFactory": "RoundFactory", "studentRegistry": "StudentRegistry"}[key]
    address = manifest[key]
    code = bytes.fromhex(cast("code", address, "--block", block, "--rpc-url", RPC)[2:])
    artifact = json.loads(open(f"contracts/out/{name}.sol/{name}.json").read())["deployedBytecode"]
    local = bytearray.fromhex(artifact["object"].removeprefix("0x"))
    remote = bytearray(code)
    for value in (local, remote):
        length = int.from_bytes(value[-2:], "big")
        if length + 2 > len(value):
            raise ValueError("Invalid Solidity metadata length")
        del value[len(value) - length - 2:]
    for refs in artifact.get("immutableReferences", {}).values():
        for ref in refs:
            start, length = ref["start"], ref["length"]
            local[start:start+length] = bytes(length)
            remote[start:start+length] = bytes(length)
    return {"contract": key, "address": address, "runtimeBytes": len(code),
            "runtimeHash": cast("keccak", "0x" + code.hex()),
            "runtimeMatchIgnoringMetadataAndImmutables": local == remote}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
    contracts = list(executor.map(check, ("mockUsdc", "roundFactory", "studentRegistry")))
rounds = call(manifest["roundFactory"], "getRounds()(address[])")
print(json.dumps({"block": block, "chainId": cast("chain-id", "--rpc-url", RPC),
    "gasPriceWeiAtQuery": cast("gas-price", "--rpc-url", RPC), "contracts": contracts,
    "factoryRegistry": call(manifest["roundFactory"], "studentRegistry()(address)"),
    "rounds": rounds, "tokenDecimals": call(manifest["mockUsdc"], "decimals()(uint8)"),
    "attester": call(manifest["studentRegistry"], "attester()(address)")}, indent=2))
