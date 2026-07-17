import { useState } from 'react'
import { ActivityFeed } from './components/ActivityFeed'
import { PreferencesView } from './components/PreferencesView'
import { TierListView } from './components/TierListView'
import { VoteView } from './components/VoteView'
import { VoterNameControl } from './components/VoterNameControl'
import { useFactions } from './hooks/useFactions'
import { getShowDispositions, setShowDispositions } from './lib/dispositions'
import { DEFAULT_GROUP_SLUG, getGroupSlugFromLocation } from './lib/group'
import { getVoterName, setVoterName } from './lib/identity'
import { getKnownFactionIds, toggleKnownFaction } from './lib/preferences'
import './App.css'

type Tab = 'vote' | 'factions' | 'tiers'

function App() {
  const [groupSlug] = useState<string>(() => getGroupSlugFromLocation())
  // Root (no slug) is the global page: it shows an aggregate roundup across
  // all groups, while voting still writes to the 'default' group.
  const isGlobal = groupSlug === DEFAULT_GROUP_SLUG
  const [tab, setTab] = useState<Tab>('vote')
  const { factions, loading, error, refetch } = useFactions(groupSlug, isGlobal)
  const [knownFactionIds, setKnownFactionIds] = useState<Set<string>>(() =>
    getKnownFactionIds(groupSlug),
  )
  const [voterName, setVoterNameState] = useState<string | null>(() => getVoterName())
  const [showDispositions, setShowDispositionsState] = useState<boolean>(() => getShowDispositions())

  function handleToggleKnown(factionId: string) {
    setKnownFactionIds(toggleKnownFaction(groupSlug, factionId))
  }

  function handleNameChange(name: string) {
    setVoterNameState(setVoterName(name))
  }

  function handleToggleDispositions() {
    const next = !showDispositions
    setShowDispositions(next)
    setShowDispositionsState(next)
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1>40K Tier List</h1>
        <p className="app__subtitle">
          Pick the stronger faction in each match-up — every vote updates that faction&rsquo;s
          Elo rating and reshapes the S&ndash;D tier list.
        </p>
        <div className="app__header-controls">
          <VoterNameControl name={voterName} onChange={handleNameChange} />
          <button
            type="button"
            className="disposition-toggle"
            aria-pressed={showDispositions}
            onClick={handleToggleDispositions}
          >
            Dispositions: {showDispositions ? 'On' : 'Off'}
          </button>
        </div>
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
          Factions
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'tiers'}
          className={`tabs__tab ${tab === 'tiers' ? 'tabs__tab--active' : ''}`}
          onClick={() => setTab('tiers')}
        >
          Tiers
        </button>
      </nav>

      <main className="app__main">
        {tab === 'vote' && (
          <VoteView
            groupSlug={groupSlug}
            factions={factions}
            loading={loading}
            error={error}
            knownFactionIds={knownFactionIds}
            voterName={voterName}
            showDispositions={showDispositions}
            onVoted={refetch}
          />
        )}
        {tab === 'factions' && (
          <PreferencesView
            groupSlug={groupSlug}
            factions={factions}
            loading={loading}
            error={error}
            knownFactionIds={knownFactionIds}
            onToggle={handleToggleKnown}
          />
        )}
        {tab === 'tiers' && (
          <div className="tiers-screen">
            <TierListView
              groupSlug={groupSlug}
              isGlobal={isGlobal}
              factions={factions}
              loading={loading}
              error={error}
            />
            <ActivityFeed
              groupSlug={groupSlug}
              isGlobal={isGlobal}
              factions={factions}
              onNewVote={refetch}
            />
          </div>
        )}
      </main>
    </div>
  )
}

export default App
