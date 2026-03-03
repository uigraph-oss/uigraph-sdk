export async function resolveCloudIcon(
  cloud: string | undefined,
  serviceName: string
) {
  const cloudName = cloud?.toLowerCase()

  const iconsLib =
    cloudName === 'azure'
      ? [...(await import('../../assets/azure-icons.json')).default]
      : cloudName === 'aws'
        ? [...(await import('../../assets/aws-icons.json')).default]
        : [
            ...(await import('../../assets/aws-icons.json')).default,
            ...(await import('../../assets/azure-icons.json')).default,
          ]

  const icon = iconsLib.find(
    (icon) => icon.name.toLowerCase() === serviceName.toLowerCase()
  )

  if (!icon) return null

  return `/${icon.cloud.toLowerCase()}-icons/${icon.category.toLowerCase()}/${icon.fileName}`
}

export async function resolveAnimatedNode(animatedIcon: string) {
  const animatedNodes = await import('../../assets/animated-nodes.json')
  const node = animatedNodes.default.find(
    (node) => node.name.toLowerCase() === animatedIcon.toLowerCase()
  )

  if (!node) return null

  return `/animated-nodes/${node.fileName}`
}
