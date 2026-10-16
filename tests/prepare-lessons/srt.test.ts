import { describe, expect, it } from 'vitest'
import { parseSrt } from '../../scripts/prepare-lessons/srt'

describe('parseSrt', () => {
  it('parses a well-formed SRT file', () => {
    const srt = `1
00:00:01,000 --> 00:00:03,500
Hello there.

2
00:00:04,000 --> 00:00:06,250
How are you?
`
    const cues = parseSrt(srt)
    expect(cues).toEqual([
      { index: 1, start: 1, end: 3.5, text: 'Hello there.' },
      { index: 2, start: 4, end: 6.25, text: 'How are you?' },
    ])
  })

  it('joins multi-line cue text with a single space', () => {
    const srt = `1
00:00:00,000 --> 00:00:02,000
Line one
Line two
`
    const cues = parseSrt(srt)
    expect(cues[0].text).toBe('Line one Line two')
  })

  it('strips HTML-style and ASS override markup', () => {
    const srt = `1
00:00:00,000 --> 00:00:02,000
{\\an8}<i>Italic</i> <b>bold</b> <font color="#fff">colored</font>
`
    const cues = parseSrt(srt)
    expect(cues[0].text).toBe('Italic bold colored')
  })

  it('handles CRLF line endings and a leading BOM', () => {
    const srt = '﻿1\r\n00:00:00,000 --> 00:00:01,000\r\nHi.\r\n'
    const cues = parseSrt(srt)
    expect(cues).toEqual([{ index: 1, start: 0, end: 1, text: 'Hi.' }])
  })

  it('accepts a dot as the millisecond separator', () => {
    const srt = `1
00:00:00.000 --> 00:00:01.000
Hi.
`
    const cues = parseSrt(srt)
    expect(cues[0]).toMatchObject({ start: 0, end: 1 })
  })

  it('skips blocks without a valid timecode line instead of throwing', () => {
    const srt = `1
not a timecode
Some text

2
00:00:05,000 --> 00:00:06,000
Valid cue.
`
    const cues = parseSrt(srt)
    expect(cues).toHaveLength(1)
    expect(cues[0].text).toBe('Valid cue.')
  })

  it('assigns a fallback sequential index when the index line is missing', () => {
    const srt = `00:00:00,000 --> 00:00:01,000
First.

00:00:02,000 --> 00:00:03,000
Second.
`
    const cues = parseSrt(srt)
    expect(cues.map((c) => c.index)).toEqual([1, 2])
  })

  it('returns an empty array for empty input', () => {
    expect(parseSrt('')).toEqual([])
  })
})
