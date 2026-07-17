import { useState } from 'react'
import { PreferencesView } from './components/PreferencesView'
import { TierListView } from './components/TierListView'
import { VoteView } from './components/VoteView'
import { useFactions } from './hooks/useFactions'
import { getKnownFactionIds, toggleKnownFaction } from './lib/preferences'
import './App.css'

type Tab = 'vote' | 'factions' | 'tiers'

function App() {
  const [tab, setTab] = useState<Tab>('vote')
  const { factions, loading, error, refetch } = useFactions()
  const [knownFactionIds, setKnownFactionIds] = useState<Set<string>>(() => getKnownFactionIds())

  function handleToggleKnown(factionId: string) {
    setKnownFactionIds(toggleKnownFaction(factionId))
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1>40K Tier List</h1>
        <p className="app__subtitle">
          Pick the stronger faction in each match-up — every vote updates that faction&rsquo;s
          Elo rating and reshapes the S&ndash;D tier list.
        </p>
      </header>

      <nav className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'vote'}
          className={`tabs__tab ${tab === 'vote' ? 'tabs__tab--active' : ''}`}
          onClick={() => setTab('vote')}
        >
          Vote
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'factions'}
          className={`tabs__tab ${tab === 'factions' ? 'tabs__tab--active' : ''}`}
          onClick={() => setTab('factions')}
        >
          My Factions
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'tiers'}
          className={`tabs__tab ${tab === 'tiers' ? 'tabs__tab--active' : ''}`}
          onClick={() => setTab('tiers')}
        >
          Tier List
        </button>
      </nav>

      <main className="app__main">
        {tab === 'vote' && (
          <VoteView
            factions={factions}
            loading={loading}
            error={error}
            knownFactionIds={knownFactionIds}
            onVoted={refetch}
          />
        )}
        {tab === 'factions' && (
          <PreferencesView
            factions={factions}
            loading={loading}
            error={error}
            knownFactionIds={knownFactionIds}
            onToggle={handleToggleKnown}
          />
        )}
        {tab === 'tiers' && <TierListView factions={factions} loading={loading} error={error} />}
      </main>
    </div>
  )
}

export default App
