import { setFxPrefs, useFxPrefs } from './prefs'
import { unlockAudio } from './sound'
import { unlockMusic } from './music'

// Three switches in the corner of every loud screen: sound effects, music and motion.
// Motion off gives still versions of every effect and a still background.

export function FxControls() {
  const { motion, sound, music } = useFxPrefs()
  return (
    <div className="fx-controls" role="group" aria-label="Effects">
      <button
        className={`fx-switch ${sound ? 'on' : ''}`}
        aria-pressed={sound}
        onClick={() => {
          setFxPrefs({ sound: !sound })
          if (!sound) unlockAudio()
        }}
      >
        <i className="fx-lamp" />
        Sound {sound ? 'on' : 'off'}
      </button>
      <button
        className={`fx-switch ${music ? 'on' : ''}`}
        aria-pressed={music}
        onClick={() => {
          setFxPrefs({ music: !music })
          unlockMusic()
        }}
      >
        <i className="fx-lamp" />
        Music {music ? 'on' : 'off'}
      </button>
      <button className={`fx-switch ${motion ? 'on' : ''}`} aria-pressed={motion} onClick={() => setFxPrefs({ motion: !motion })}>
        <i className="fx-lamp" />
        Motion {motion ? 'on' : 'off'}
      </button>
    </div>
  )
}
