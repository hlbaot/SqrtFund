// Frozen pre-rejection read ABI. Existing rounds keep the old tuple layout.
export const legacyProjectAbi = [
  {
    "type": "function",
    "name": "getProject",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "projectName",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "description",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "imageUrl",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "link",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "approved",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "claimed",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "sumSqrt",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "totalDonated",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "donorCount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getProjects",
    "inputs": [
      {
        "name": "offset",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "limit",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "items",
        "type": "tuple[]",
        "internalType": "struct QFRound.ProjectView[]",
        "components": [
          {
            "name": "id",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "owner",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "name",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "description",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "imageUrl",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "link",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "approved",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "claimed",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "sumSqrt",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "totalDonated",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "donorCount",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      },
      {
        "name": "total",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  }
] as const;
