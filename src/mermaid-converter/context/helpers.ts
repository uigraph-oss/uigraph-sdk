export async function resolveCloudIcon(cloud: string, serviceName: string) {
  const cloudName = cloud.toLowerCase()

  const iconsLib =
    cloudName === 'azure'
      ? await import('../../assets/azure-icons.json')
      : cloudName === 'aws'
        ? await import('../../assets/aws-icons.json')
        : undefined

  if (!iconsLib) return null

  const icon = iconsLib.default.find((icon) => icon.name === serviceName)
  return `/${cloudName}-icons/${icon?.category}/${icon?.fileName}`
}

export async function resolveAnimatedNode(animatedIcon: string) {
  const animatedNodes = await import('../../assets/animated-nodes.json')
  return `/animated-nodes/${animatedNodes.default.find((node) => node.name === animatedIcon)?.fileName}`
}
