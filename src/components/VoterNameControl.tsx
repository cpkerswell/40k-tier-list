import { useState } from 'react'

interface VoterNameControlProps {
  name: string
  onChange: (name: string) => void
}

export function VoterNameControl({ name, onChange }: VoterNameControlProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)

  if (editing) {
    return (
      <form
        className="voter-name voter-name--editing"
        onSubmit={(event) => {
          event.preventDefault()
          onChange(draft)
          setEditing(false)
        }}
      >
        <input
          type="text"
          className="voter-name__input"
          value={draft}
          maxLength={40}
          placeholder="Your name"
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className="voter-name__save">
          Save
        </button>
      </form>
    )
  }

  return (
    <button
      type="button"
      className="voter-name"
      onClick={() => {
        setDraft(name)
        setEditing(true)
      }}
    >
      Voting as {name}
    </button>
  )
}
