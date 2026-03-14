# HTML Artifact Format

Template for the rendered HTML presentation layer served via the web channel.

## Layout Structure

```html
<article>
  <header>
    <h1>{title}</h1>
    <confidence-badge score="{confidence}" />
    <metadata>
      Recipe: {metadata.recipe} | Session: {metadata.session_id}
      Radars: {metadata.radars_matched.join(", ")}
      Generated: {metadata.timestamp}
    </metadata>
  </header>

  <sections>
    {sections.map(section => (
      <section>
        <h2>{section.heading}</h2>
        <div>{section.content}</div>
      </section>
    ))}
  </sections>

  <sources>
    <h3>Sources</h3>
    {sources.map(source => (
      <source-citation claim="{source.claim}" path="{source.signal_path}" />
    ))}
  </sources>

  {training_sourced.length > 0 && (
    <training-disclaimer>
      <h4>Training-Sourced (not from your knowledge)</h4>
      {training_sourced.map(claim => <p>{claim}</p>)}
    </training-disclaimer>
  )}

  {confidence_gaps.length > 0 && (
    <gaps>
      <h4>What would increase confidence</h4>
      <ul>{confidence_gaps.map(gap => <li>{gap}</li>)}</ul>
    </gaps>
  )}
</article>
```

## Confidence Badge

| Score | Color | Label |
|-------|-------|-------|
| >= 0.8 | Green | High confidence |
| 0.5–0.79 | Yellow | Medium confidence |
| < 0.5 | Red | Low confidence |

## Rules

- Confidence badge is always visible at the top
- Training-sourced section is visually distinct (border, different background)
- Source citations link to vault signal paths
- Served at token-authenticated URL: `/artifacts/[id]?token=xxx`
