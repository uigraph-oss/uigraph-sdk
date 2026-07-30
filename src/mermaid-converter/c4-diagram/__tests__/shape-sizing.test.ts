import { describe, expect, it } from 'vitest'
import { convertC4MermaidToReactFlow } from '../to-react-flow'

function heightOf(code: string, id: string) {
  const flow = convertC4MermaidToReactFlow(code)

  return flow.nodes.find((node) => node.id === id)!.height as number
}

describe('what makes a C4 shape taller', () => {
  it('leaves room for the cylinder lips of a database', () => {
    const plain = heightOf(
      'C4Context\n System(a, "Store", "Keeps it all")',
      'a'
    )
    const database = heightOf(
      'C4Context\n SystemDb(a, "Store", "Keeps it all")',
      'a'
    )

    expect(database).toBeGreaterThan(plain)
  })

  it('wraps a queue sooner because its caps eat into the text band', () => {
    const label = 'Publishes every banking event onto the shared bus'
    const plain = heightOf(`C4Context\n System(a, "${label}")`, 'a')
    const queue = heightOf(`C4Context\n SystemQueue(a, "${label}")`, 'a')

    expect(queue).toBeGreaterThan(plain)
  })

  it('leaves room for the head and shoulders drawn on a person', () => {
    const system = heightOf('C4Context\n System(a, "Someone")', 'a')
    const person = heightOf('C4Context\n Person(a, "Someone")', 'a')

    expect(person).toBeGreaterThan(system)
  })

  it('adds a line for the technology a container names', () => {
    const bare = heightOf('C4Container\n Container(a, "API")', 'a')
    const withTechnology = heightOf(
      'C4Container\n Container(a, "API", "Java")',
      'a'
    )

    expect(withTechnology).toBeGreaterThan(bare)
  })
})
