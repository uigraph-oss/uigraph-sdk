import { describe, expect, it } from 'vitest'
import { resolveAnimatedNode, resolveCloudIcon } from './helpers'

describe('resolveCloudIcon', () => {
  it('finds aws icon case-insensitively', async () => {
    const result = await resolveCloudIcon('AWS', 'Amazon Athena')
    expect(result).toBe(
      '/aws-icons/Architecture-Service-Icons_07312025/Arch_Analytics/64/Arch_Amazon-Athena_64.svg'
    )
  })

  it('finds azure icon case-insensitively', async () => {
    const result = await resolveCloudIcon('azure', 'Azure OpenAI')
    expect(result).toBe(
      '/azure-icons/ai + machine learning/03438-icon-service-Azure-OpenAI.svg'
    )
  })

  it('returns null when not found', async () => {
    const result = await resolveCloudIcon('aws', 'Not A Service')
    expect(result).toBeNull()
  })

  it('searches across clouds when cloud is undefined', async () => {
    const result = await resolveCloudIcon(undefined, 'Azure OpenAI')
    expect(result).toBe(
      '/azure-icons/ai + machine learning/03438-icon-service-Azure-OpenAI.svg'
    )
  })
})

describe('resolveAnimatedNode', () => {
  it('resolves animated node path case-insensitively', async () => {
    const result = await resolveAnimatedNode('Loading')
    expect(result).toBe('/animated-nodes/Loading.gif')
  })

  it('returns null when animated node is not found', async () => {
    const result = await resolveAnimatedNode('Missing')
    expect(result).toBeNull()
  })
})
