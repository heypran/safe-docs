const shell = require('shelljs')
const fs = require('fs')
const path = require('path')

const walkPath = dir => {
  let results = []
  const list = fs.readdirSync(dir)
  list.forEach(function (file) {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    if (stat?.isDirectory()) {
      results = results.concat(walkPath(filePath))
    } else {
      results.push(filePath)
    }
  })

  return results
}

const deduplicate = () => [
  (acc, curr) => {
    if (acc.includes(curr)) {
      return acc
    }

    return [...acc, curr]
  },
  []
]

const supportedNetworksPath = './safe-smart-account/supported-networks'

const generateSupportedNetworks = async () => {
  const deploymentRepoUrl = 'https://github.com/safe-global/safe-deployments/'
  shell.exec(`git clone ${deploymentRepoUrl} ./deployments`)
  shell.rm('-rf', supportedNetworksPath)

  const fetch = await import('node-fetch')
  const paths = walkPath('deployments/src/assets').map(p =>
    p.replace('deployments/src/assets/', '')
  )

  const allNetworks = await fetch
    .default('https://chainid.network/chains.json')
    .then(res => res.json())

  const contracts = paths.map(p => {
    const file = fs.readFileSync(`deployments/src/assets/${p}`, 'utf8')
    const json = JSON.parse(file)

    return Object.entries(json.networkAddresses).map(([chainId, address]) => ({
      name: p.split('/')[1].split('.')[0],
      version: p.split('/')[0],
      address,
      chainId,
      chainName: allNetworks.find(n => n.chainId === parseInt(chainId))?.name,
      blockExplorerUrl: allNetworks.find(n => n.chainId === parseInt(chainId))
        ?.explorers?.[0]?.url
    }))
  })

  const versions = contracts
    .flat()
    .map(c => c.version)
    .reduce(...deduplicate())
    .reverse()

  shell.mkdir(supportedNetworksPath)

  versions.forEach(version => {
    const _contracts = contracts.flat().filter(c => c.version === version)

    const networks = Object.entries(
      _contracts.reduce((acc, curr) => {
        const { chainId, chainName } = curr
        if (acc[chainId]) {
          return acc
        }

        return {
          ...acc,
          [chainId]: chainName
        }
      }, {})
    )

    const content = `# ${version}

This page lists the addresses of all the Safe contracts \`${version}\` grouped by chain.

## Networks
${networks
  .map(([chainId, network]) => {
    return `
### ${network}

This network's chain ID is ${chainId}.

${_contracts
  .filter(c => c.chainId === chainId)
  .map(
    c =>
      `- \`${c.name}.sol\`: ${
        c.blockExplorerUrl == null || deprecatedBlockExplorers.includes(c.blockExplorerUrl)
          ? c.address
          : `[${c.address}](${c.blockExplorerUrl}/address/${c.address})`
      }`
  )
  .join('\n')}
`
  })
  .join('\n')}

    `
    fs.writeFileSync(`${supportedNetworksPath}/${version}.md`, content)
  })

  shell.rm('-rf', './deployments')
}

generateSupportedNetworks()

const deprecatedBlockExplorers = [
  'https://ropsten.etherscan.io',
  'https://rinkeby.etherscan.io',
  'https://kovan-optimistic.etherscan.io',
  'https://stardust-explorer.metis.io',
  'https://blockexplorer.rinkeby.boba.network',
  'https://blockexplorer.bobabeam.boba.network',
  'https://rabbit.analogscan.com',
  'https://explorer.eurus.network',
  'https://testnetexplorer.eurus.network',
  'https://explorer.tst.publicmint.io',
  'https://evm-testnet.venidiumexplorer.com',
  'https://evm.venidiumexplorer.com',
  'https://evm.explorer.canto.io',
  'https://explorer.autobahn.network',
  'https://explorer.cascadia.foundation',
]
