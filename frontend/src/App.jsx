import { useMemo, useState } from 'react'
import './App.css'

import splitLeaf from './assets/figma/Split Leaf.png'
import evergreen from './assets/figma/Evergreen.png'
import polypodium from './assets/figma/Polypodium.png'
import musacae from './assets/figma/Musacae.png'
import clusiacaeTwo from './assets/figma/Clusiacae (2).png'
import kids from './assets/figma/Kids.svg'
import iImage from './assets/AAC_BOARD_DEFAULT/I.png'
import wantImage from './assets/AAC_BOARD_DEFAULT/Want.png'
import needImage from './assets/AAC_BOARD_DEFAULT/Need.png'
import likeImage from './assets/AAC_BOARD_DEFAULT/Like.png'
import dislikeImage from './assets/AAC_BOARD_DEFAULT/Dislike.png'
import yesImage from './assets/AAC_BOARD_DEFAULT/AAC_BOARD_DEAFULT_ROW2/yes.png'
import noImage from './assets/AAC_BOARD_DEFAULT/AAC_BOARD_DEAFULT_ROW2/no.png'
import moreImage from './assets/AAC_BOARD_DEFAULT/AAC_BOARD_DEAFULT_ROW2/more.png'
import allDoneImage from './assets/AAC_BOARD_DEFAULT/AAC_BOARD_DEAFULT_ROW2/all_Done.png'
import againImage from './assets/AAC_BOARD_DEFAULT/AAC_BOARD_DEAFULT_ROW2/again.png'
import eatImage from './assets/AAC_BOARD_DEFAULT/AAC_BOARD_DEFAULT_ROW3/eat.png'
import drinkImage from './assets/AAC_BOARD_DEFAULT/AAC_BOARD_DEFAULT_ROW3/drink.png'
import bathroomImage from './assets/AAC_BOARD_DEFAULT/AAC_BOARD_DEFAULT_ROW3/bathroom.png'
import hurtImage from './assets/AAC_BOARD_DEFAULT/AAC_BOARD_DEFAULT_ROW3/hurt.png'
import helpImage from './assets/AAC_BOARD_DEFAULT/AAC_BOARD_DEFAULT_ROW3/help.png'
import breakImage from './assets/AAC_BOARD_DEFAULT/AAC_BOARD_DEFAULT_ROW3/break.png'
import happyImage from './assets/AAC_BOARD_DEFAULT/AAC_BOARD_DEFAULT_ROW4/happy_big.png'
import sadImage from './assets/AAC_BOARD_DEFAULT/AAC_BOARD_DEFAULT_ROW4/sad_big.png'
import madImage from './assets/AAC_BOARD_DEFAULT/AAC_BOARD_DEFAULT_ROW4/angry_big.png'
import tiredImage from './assets/AAC_BOARD_DEFAULT/AAC_BOARD_DEFAULT_ROW4/Tired_big.png'
import goImage from './assets/AAC_BOARD_DEFAULT/AAC_BOARD_DEFAULT_ROW4/go.png'
import stopImage from './assets/AAC_BOARD_DEFAULT/AAC_BOARD_DEFAULT_ROW4/stop.png'

const rows = [
  { category: 'core', label: 'Core words', words: [{ label: 'I', image: iImage }, { label: 'want', image: wantImage }, { label: 'need', image: needImage }, { label: 'like', image: likeImage }, { label: "don't like", image: dislikeImage }, { label: 'something else' }] },
  { category: 'responses', label: 'Responses', words: [{ label: 'yes', image: yesImage }, { label: 'no', image: noImage }, { label: 'more', image: moreImage }, { label: 'all done', image: allDoneImage }, { label: 'again', image: againImage }, { label: 'wait' }] },
  { category: 'needs', label: 'Needs', words: [{ label: 'eat', image: eatImage }, { label: 'drink', image: drinkImage }, { label: 'bathroom', image: bathroomImage }, { label: 'hurt', image: hurtImage }, { label: 'help', image: helpImage }, { label: 'break', image: breakImage }] },
  { category: 'emotions', label: 'Emotions and actions', words: [{ label: 'happy', image: happyImage }, { label: 'sad', image: sadImage }, { label: 'mad', image: madImage }, { label: 'tired', image: tiredImage }, { label: 'go', image: goImage }, { label: 'stop', image: stopImage }] },
]

function speak(text, settings) {
  if (!settings.sound) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.voice = window.speechSynthesis.getVoices().find((voice) => voice.lang.startsWith('en')) || null
  utterance.rate = settings.rate
  window.speechSynthesis.speak(utterance)
}

function LeafDecor() { return <><img className="plant plant-evergreen" src={evergreen} alt="" /><img className="plant plant-polypodium" src={polypodium} alt="" /><img className="plant plant-split-leaf" src={splitLeaf} alt="" /></> }

function Login({ onLogin }) {
  return <main className="login-page"><section className="intro-panel"><LeafDecor /><div className="brand-lockup"><h1>Bridge<br />Board</h1><p>An AI-powered AAC Board</p></div><div className="kids"><img className="kids-art" src={kids} alt="Two children using communication devices" /><div className="sound-waves" aria-hidden="true"><span></span><span></span><span></span></div></div></section><section className="feature-panel"><form className="login-form" onSubmit={onLogin}><h2>Welcome Back, Cha</h2><p>Sign in to access your communication board</p><label htmlFor="email">Email</label><input id="email" type="email" placeholder="you@example.com" required /><div className="password-heading"><label htmlFor="password">Password</label><a href="#forgot-password">Forgot password?</a></div><input id="password" type="password" placeholder="Enter your password" required /><button className="continue-button" type="submit">Continue</button><div className="form-divider"><span>or</span></div><button className="google-button" type="button"><svg className="google-logo" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.35 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.42z" /><path fill="#34A853" d="M12 21.5c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.7-1.72-5.47-4.03H3.28v2.52A9.74 9.74 0 0 0 12 21.5z" /><path fill="#FBBC05" d="M6.53 13.58A5.86 5.86 0 0 1 6.22 12c0-.55.1-1.08.31-1.58V7.9H3.28A9.74 9.74 0 0 0 2.25 12c0 1.57.38 3.05 1.03 4.1l3.25-2.52z" /><path fill="#EA4335" d="M12 6.39c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.5 14.63 2.5 12 2.5a9.74 9.74 0 0 0-8.72 5.4l3.25 2.52C7.3 8.11 9.46 6.39 12 6.39z" /></svg>Continue with Google</button><p className="signup-prompt"><span className="signup-copy">Don&apos;t have an account?</span> <a className="sign-up-link" href="#sign-up">Sign up</a></p></form></section></main>
}

function ProfileSelector({ onSelect, onCaregiver }) {
  return <main className="center-page profile-page"><img className="profile-leaf profile-leaf-top" src={evergreen} alt="" /><img className="profile-leaf profile-leaf-bottom" src={splitLeaf} alt="" /><img className="profile-musacae" src={musacae} alt="" /><img className="profile-clusiacae" src={clusiacaeTwo} alt="" /><section className="selector-card"><span className="eyebrow">Your communication board</span><h1>Who is communicating today?</h1><p className="muted-copy">Choose a profile to get to the board quickly.</p><div className="profile-grid"><button className="profile-card selected" onClick={() => onSelect('Cha')}><span className="avatar">C</span><span><strong>Cha</strong><small>Default AAC board</small></span><span className="check">✓</span></button><button className="profile-card add-profile" onClick={() => onSelect('New profile')}><span className="plus">+</span><span><strong>Add profile</strong><small>For a family member or student</small></span></button></div><button className="text-button" onClick={onCaregiver}>Caregiver settings →</button></section></main>
}

function Setup({ onFinish, settings, setSettings }) {
  return <main className="center-page profile-page setup-page"><img className="profile-leaf profile-leaf-top" src={evergreen} alt="" /><img className="profile-leaf profile-leaf-bottom" src={splitLeaf} alt="" /><img className="profile-musacae" src={musacae} alt="" /><img className="profile-clusiacae" src={clusiacaeTwo} alt="" /><section className="setup-card"><span className="eyebrow">A quick start</span><h1>Set up {settings.name || 'your board'}</h1><p className="muted-copy">You can change these choices anytime in caregiver settings.</p><div className="setup-grid"><label>Preferred name<input value={settings.name} onChange={(e) => setSettings({ ...settings, name: e.target.value })} placeholder="Cha" /></label><label>Preferred voice<select value={settings.voice} onChange={(e) => setSettings({ ...settings, voice: e.target.value })}><option>Warm English</option><option>Clear English</option><option>Use device voice</option></select></label><div className="setup-field"><span className="field-label">Button size</span><div className="choice-row"><button type="button" className={settings.buttonSize === 'large' ? 'choice active' : 'choice'} onClick={() => setSettings({ ...settings, buttonSize: 'large' })}>Large</button><button type="button" className={settings.buttonSize === 'standard' ? 'choice active' : 'choice'} onClick={() => setSettings({ ...settings, buttonSize: 'standard' })}>Standard</button></div></div><label className="toggle-row"><span><strong>Sound on</strong><small>Speak each choice aloud</small></span><input type="checkbox" checked={settings.sound} onChange={(e) => setSettings({ ...settings, sound: e.target.checked })} /></label></div><div className="setup-actions"><button className="secondary-button" onClick={onFinish}>Set up later</button><button className="primary-button" onClick={onFinish}>Continue to board</button></div></section></main>
}

function AACButton({ word, onSelect, large }) { return <button className={`aac-card${word.image ? '' : ' text-only'}${large ? ' large-buttons' : ''}`} type="button" onClick={() => onSelect(word)}>{word.image && <img src={word.image} alt="" />}<span>{word.label}</span></button> }

function DefaultBoard({ settings, setHistory }) {
  const [message, setMessage] = useState([])
  function selectWord(word) { setMessage((current) => [...current, word.label]); setHistory((current) => [word.label, ...current].slice(0, 12)); speak(word.label, settings) }
  return <section className="board-view"><section className="aac-content" aria-label="Default AAC vocabulary">{rows.map((row) => <section className={`aac-row aac-row-${row.category}`} key={row.category} aria-label={row.label}><div className="aac-grid">{row.words.map((word) => <AACButton key={word.label} word={word} large={settings.buttonSize === 'large'} onSelect={selectWord} />)}</div></section>)}</section><section className="message-bar"><div className="message-heading"><h2>Your message</h2><span>{message.length} {message.length === 1 ? 'word' : 'words'}</span></div><div className="message-box"><div className="message-chips" aria-live="polite">{message.length ? message.map((word, index) => <span className="message-chip" key={`${word}-${index}`}>{word}</span>) : <span className="message-empty">Tap a picture to build a sentence</span>}</div><div className="message-actions"><button onClick={() => setMessage((current) => current.slice(0, -1))} disabled={!message.length}>⌫</button><button onClick={() => setMessage([])} disabled={!message.length}>Clear</button><button className="speak-message" onClick={() => speak(message.join(' '), settings)} disabled={!message.length}>Speak</button></div></div></section></section>
}

function AIAAC({ onNavigate, settings, setHistory }) {
  const [listening, setListening] = useState(false); const [transcript, setTranscript] = useState(''); const choices = useMemo(() => ['I need help', 'I want a break', 'I am okay', 'Please repeat'], [])
  function listen() { setListening(true); setTranscript('Listening for a caregiver question…'); window.setTimeout(() => { setListening(false); setTranscript('Would you like to keep going or take a break?') }, 1100) }
  function choose(choice) { setHistory((current) => [choice, ...current].slice(0, 12)); speak(choice, settings) }
  return <section className="mode-view"><div className="mode-header"><div><span className="eyebrow">Optional support</span><h1>AI AAC</h1><p>Listen for a question and get a few simple choices.</p></div><button className="home-button" onClick={() => onNavigate('home')}>⌂ Full Board</button></div><div className="ai-card"><div className="ai-listen"><button className={`listen-button${listening ? ' listening' : ''}`} onClick={listen}>{listening ? 'Listening…' : '● Listen'}</button><p>{transcript || 'Caregiver mode is private until you tap Listen.'}</p></div><div className="choice-list">{choices.map((choice) => <button key={choice} onClick={() => choose(choice)}>{choice}<span>Speak</span></button>)}</div></div><div className="quick-actions"><span>Always available</span>{['Help', 'No', 'Repeat', 'Stop'].map((item) => <button key={item} onClick={() => choose(item)}>{item}</button>)}<button className="full-board-action" onClick={() => onNavigate('home')}>Full Board</button></div></section>
}

function Caregiver({ onNavigate }) { return <section className="simple-view"><div className="view-heading"><div><span className="eyebrow">For caregivers</span><h1>Caregiver mode</h1><p>Make the board fit the way your family communicates.</p></div><button className="home-button" onClick={() => onNavigate('home')}>Home</button></div><div className="settings-grid"><article className="settings-card"><span className="card-icon">✦</span><h2>Vocabulary</h2><p>Add personal photos and words to the board.</p><button className="secondary-button">Customize board</button></article><article className="settings-card"><span className="card-icon">◉</span><h2>AI listening & privacy</h2><p>AI only listens after a caregiver taps Listen.</p><button className="secondary-button">Review privacy</button></article><article className="settings-card"><span className="card-icon">Aa</span><h2>Display</h2><p>Adjust button size, contrast, and motion.</p><button className="secondary-button" onClick={() => onNavigate('settings')}>Open display settings</button></article></div></section> }

function History({ history, onNavigate }) { return <section className="simple-view"><div className="view-heading"><div><span className="eyebrow">A gentle record</span><h1>History</h1><p>Recently used phrases and choices—not a performance score.</p></div><button className="home-button" onClick={() => onNavigate('home')}>Home</button></div><div className="history-card">{history.length ? history.map((item, index) => <div className="history-item" key={`${item}-${index}`}><span>{item}</span><small>Recently used</small></div>) : <div className="empty-state"><span className="empty-illustration">♡</span><h2>No phrases yet</h2><p>Choices from the board will appear here.</p></div>}</div></section> }

function Settings({ settings, setSettings, onNavigate }) { return <section className="simple-view"><div className="view-heading"><div><span className="eyebrow">Make it yours</span><h1>Settings</h1><p>Change communication preferences at any time.</p></div><button className="home-button" onClick={() => onNavigate('home')}>Home</button></div><div className="settings-list"><label><span><strong>Speech rate</strong><small>How quickly choices are spoken</small></span><input type="range" min="0.6" max="1.3" step="0.1" value={settings.rate} onChange={(e) => setSettings({ ...settings, rate: Number(e.target.value) })} /></label><label><span><strong>Sound</strong><small>Speak choices after tapping</small></span><input type="checkbox" checked={settings.sound} onChange={(e) => setSettings({ ...settings, sound: e.target.checked })} /></label><label><span><strong>Button size</strong><small>Use larger buttons for easier access</small></span><select value={settings.buttonSize} onChange={(e) => setSettings({ ...settings, buttonSize: e.target.value })}><option value="large">Large</option><option value="standard">Standard</option></select></label><label><span><strong>Quiet mode</strong><small>Keep speech off while browsing</small></span><input type="checkbox" /></label><button className="danger-button">Reset profile</button></div></section> }

function App() {
  const [stage, setStage] = useState('login'); const [view, setView] = useState('home'); const [settings, setSettings] = useState({ name: 'Cha', voice: 'Warm English', buttonSize: 'large', sound: true, rate: 0.9 }); const [history, setHistory] = useState([])
  function navigate(nextView) { setView(nextView) }
  if (stage === 'login') return <Login onLogin={(event) => { event.preventDefault(); setStage('profiles') }} />
  if (stage === 'profiles') return <ProfileSelector onSelect={() => setStage('setup')} onCaregiver={() => { setStage('app'); setView('caregiver') }} />
  if (stage === 'setup') return <Setup settings={settings} setSettings={setSettings} onFinish={() => { setStage('app'); setView('home') }} />
  return <main className="app-page"><header className="app-nav"><button className="brand-button" onClick={() => navigate('home')}><span>BridgeBoard</span></button><nav><button className={view === 'home' ? 'active' : ''} onClick={() => navigate('home')}>Default AAC</button><button className={view === 'ai' ? 'active' : ''} onClick={() => navigate('ai')}>AI AAC</button><button className={view === 'history' ? 'active' : ''} onClick={() => navigate('history')}>History</button></nav><button className="profile-pill" onClick={() => navigate('caregiver')}><span className="mini-avatar">C</span> {settings.name}</button></header><div className="app-content">{view === 'home' && <DefaultBoard settings={settings} setHistory={setHistory} />}{view === 'ai' && <AIAAC settings={settings} setHistory={setHistory} onNavigate={navigate} />}{view === 'history' && <History history={history} onNavigate={navigate} />}{view === 'caregiver' && <Caregiver onNavigate={navigate} />}{view === 'settings' && <Settings settings={settings} setSettings={setSettings} onNavigate={navigate} />}</div></main>
}

export default App
