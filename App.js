/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║            🍅  POMODORO TIMER — Expo App                    ║
 * ║                                                              ║
 * ║  Install dependencies:                                       ║
 * ║  npx expo install react-native-svg expo-linear-gradient \    ║
 * ║    react-native-safe-area-context expo-splash-screen         ║
 * ║                                                              ║
 * ║  npm install lucide-react-native \                           ║
 * ║    @expo-google-fonts/inter \                                ║
 * ║    @expo-google-fonts/jetbrains-mono expo-font               ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  StatusBar,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
} from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import * as SplashScreen from 'expo-splash-screen';
import {
  Timer as TimerIcon,
  BarChart2,
  CheckSquare,
  RotateCcw,
  Play,
  Pause,
  SkipForward,
  Target,
  Clock,
  Flame,
} from 'lucide-react-native';

SplashScreen.preventAutoHideAsync();

// ─── SVG ring constants ───────────────────────────────────────────────────────
const R    = 120;
const SW   = 6;
const SIZE = (R + SW) * 2;          // 252 px
const CIRC = 2 * Math.PI * R;       // ≈ 753.98 px

// ─── Timer durations (seconds) ────────────────────────────────────────────────
const DURATIONS = { Focus: 25 * 60, Short: 5 * 60, Long: 15 * 60 };
const MODE_LABEL = { Focus: 'FOCUS', Short: 'SHORT BREAK', Long: 'LONG BREAK' };

// ─── Palette ──────────────────────────────────────────────────────────────────
const P = {
  bg:          '#030f06',
  primary:     '#22c55e',
  bright:      '#4ade80',
  deep:        '#16a34a',
  fg:          '#e8f5ec',
  muted:       '#6b8f74',
  track:       'rgba(18,40,23,0.5)',
  card:        'rgba(10,22,13,0.5)',
  border:      'rgba(30,55,36,0.3)',
  tabBg:       'rgba(8,20,11,0.4)',
  navBg:       'rgba(8,20,11,0.82)',
  glowTL:      'rgba(22,163,74,0.11)',
  glowBR:      'rgba(22,163,74,0.08)',
  ringGlow:    'rgba(22,163,74,0.05)',
  navInd:      'rgba(34,197,94,0.10)',
  dot:         'rgba(18,40,23,0.6)',
};

// Animated SVG circle (useNativeDriver: false required for SVG props)
const AniCircle = Animated.createAnimatedComponent(Circle);

// ─── Bottom nav items ────────────────────────────────────────────────────────
const NAV = [
  { key: 'Focus',   label: 'Focus',   Icon: TimerIcon   },
  { key: 'History', label: 'History', Icon: BarChart2   },
  { key: 'Todo',    label: 'To-Do',   Icon: CheckSquare },
];

// ─── Stat cards config ───────────────────────────────────────────────────────
const STAT_CARDS = [
  { id: 'sessions', label: 'SESSIONS', Icon: Target },
  { id: 'minutes',  label: 'MINUTES',  Icon: Clock  },
  { id: 'streak',   label: 'STREAK',   Icon: Flame  },
];

// ═════════════════════════════════════════════════════════════════════════════
//  Main Screen
// ═════════════════════════════════════════════════════════════════════════════
function PomodoroScreen() {
  const insets = useSafeAreaInsets();

  // ── core state ──────────────────────────────────────────────────────────
  const [mode,    setMode]    = useState('Focus');
  const [secs,    setSecs]    = useState(DURATIONS.Focus);
  const [running, setRunning] = useState(false);
  const [dots,    setDots]    = useState([false, false, false, false]);
  const [stats,   setStats]   = useState({ sessions: 0, minutes: 0, streak: 0 });
  const [nav,     setNav]     = useState('Focus');

  // ── refs ────────────────────────────────────────────────────────────────
  const prevSecs  = useRef(secs);
  const modeRef   = useRef(mode);   // always current mode inside effects
  modeRef.current = mode;

  // ── animated values ─────────────────────────────────────────────────────
  const arcOffset = useRef(new Animated.Value(0)).current;
  const fadeIn    = useRef(new Animated.Value(0)).current;
  const dotScales = useRef(
    [0, 1, 2, 3].map(() => new Animated.Value(1))
  ).current;

  // ── entrance fade ────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(fadeIn, {
      toValue: 1, duration: 700, useNativeDriver: true,
    }).start();
  }, []);

  // ── arc animation (drives on every secs/mode change) ─────────────────────
  useEffect(() => {
    const progress = secs / DURATIONS[mode];
    Animated.timing(arcOffset, {
      toValue: CIRC * (1 - progress),
      duration: 450,
      useNativeDriver: false,   // SVG props don't support native driver
    }).start();
  }, [secs, mode]);

  // ── countdown interval ────────────────────────────────────────────────────
  useEffect(() => {
    if (!running) return;
    const id = setInterval(
      () => setSecs(s => (s > 0 ? s - 1 : 0)),
      1000,
    );
    return () => clearInterval(id);
  }, [running]);

  // ── session completion logic ──────────────────────────────────────────────
  useEffect(() => {
    if (secs === 0 && prevSecs.current > 0) {
      setRunning(false);

      if (modeRef.current === 'Focus') {
        // Fill next empty dot with bounce animation
        setDots(prev => {
          const next  = [...prev];
          const idx   = next.indexOf(false);
          if (idx !== -1) {
            next[idx] = true;
            // Bounce the filled dot
            Animated.sequence([
              Animated.timing(dotScales[idx], {
                toValue: 1.6, duration: 200, useNativeDriver: true,
              }),
              Animated.spring(dotScales[idx], {
                toValue: 1, friction: 4, useNativeDriver: true,
              }),
            ]).start();
            // If all 4 done, reset after short delay
            if (idx === 3) {
              setTimeout(() => {
                setDots([false, false, false, false]);
                dotScales.forEach(d => d.setValue(1));
              }, 1500);
            }
          }
          return next;
        });

        setStats(s => ({
          sessions: s.sessions + 1,
          minutes:  s.minutes  + 25,
          streak:   s.streak   + 1,
        }));
      }
    }
    prevSecs.current = secs;
  }, [secs]);

  // ── actions ───────────────────────────────────────────────────────────────
  const changeMode = m => {
    if (m === mode) return;
    setMode(m);
    setSecs(DURATIONS[m]);
    setRunning(false);
  };

  const handleReset = () => {
    setSecs(DURATIONS[mode]);
    setRunning(false);
  };

  const handleSkip = () => {
    setSecs(0);
    setRunning(false);
  };

  // ── display values ────────────────────────────────────────────────────────
  const mm  = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss  = String(secs % 60).padStart(2, '0');
  const cx  = SIZE / 2;

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── Ambient atmosphere glows ── */}
      <View style={styles.glowTL} />
      <View style={styles.glowBR} />

      {/* ── Scrollable / main content ── */}
      <Animated.View style={[styles.content, { opacity: fadeIn }]}>

        {/* ════════════ HEADER ════════════ */}
        <View style={styles.header}>
          <Text style={styles.hTitle}>Pomodoro</Text>
          <Text style={styles.hSub}>Stay focused, stay productive</Text>
        </View>

        {/* ════════════ MODE SELECTOR ════════════ */}
        <View style={styles.modeBar}>
          {['Focus', 'Short', 'Long'].map(m => (
            <TouchableOpacity
              key={m}
              style={[styles.mTab, mode === m && styles.mTabActive]}
              onPress={() => changeMode(m)}
              activeOpacity={0.8}
            >
              <Text style={[styles.mTabTxt, mode === m && styles.mTabTxtActive]}>
                {m}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ════════════ TIMER RING ════════════ */}
        <View style={styles.ringWrap}>
          {/* ambient pulse glow behind ring */}
          <View style={styles.ringGlow} />

          <Svg width={SIZE} height={SIZE}>
            <Defs>
              <SvgGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%"   stopColor={P.bright} />
                <Stop offset="100%" stopColor={P.deep}   />
              </SvgGradient>
            </Defs>

            {/* Background track */}
            <Circle
              cx={cx} cy={cx} r={R}
              fill="none"
              stroke={P.track}
              strokeWidth={SW}
            />

            {/* Progress arc — animated */}
            <AniCircle
              cx={cx} cy={cx} r={R}
              fill="none"
              stroke="url(#arcGrad)"
              strokeWidth={SW}
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={arcOffset}
              transform={`rotate(-90, ${cx}, ${cx})`}
            />
          </Svg>

          {/* Center text overlay */}
          <View style={styles.ringCenter}>
            <Text style={styles.ringMM}>{mm}</Text>
            <Text style={styles.ringSS}>{ss}</Text>
            <Text style={styles.ringMode}>{MODE_LABEL[mode]}</Text>
          </View>
        </View>

        {/* ════════════ SESSION DOTS ════════════ */}
        <View style={styles.dotsRow}>
          {dots.map((on, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                on && styles.dotOn,
                { transform: [{ scale: dotScales[i] }] },
              ]}
            />
          ))}
        </View>

        {/* ════════════ CONTROLS ════════════ */}
        <View style={styles.ctrlRow}>
          {/* Reset */}
          <TouchableOpacity
            style={styles.sideBtn}
            onPress={handleReset}
            activeOpacity={0.8}
          >
            <RotateCcw size={20} color={P.muted} />
          </TouchableOpacity>

          {/* Play / Pause */}
          <TouchableOpacity
            onPress={() => setRunning(v => !v)}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[P.bright, P.deep]}
              start={{ x: 0.15, y: 0 }}
              end={{ x: 0.85, y: 1 }}
              style={styles.playBtn}
            >
              {running
                ? <Pause size={28} color={P.bg} fill={P.bg} />
                : <Play  size={28} color={P.bg} fill={P.bg} />
              }
            </LinearGradient>
          </TouchableOpacity>

          {/* Skip */}
          <TouchableOpacity
            style={styles.sideBtn}
            onPress={handleSkip}
            activeOpacity={0.8}
          >
            <SkipForward size={20} color={P.muted} />
          </TouchableOpacity>
        </View>

        {/* ════════════ STATS CARDS ════════════ */}
        <View style={styles.statsRow}>
          {STAT_CARDS.map(({ id, label, Icon }) => (
            <View key={id} style={styles.card}>
              <Icon size={16} color={P.primary} />
              <Text style={styles.cardVal}>{stats[id]}</Text>
              <Text style={styles.cardLbl}>{label}</Text>
            </View>
          ))}
        </View>

      </Animated.View>

      {/* ════════════ BOTTOM NAV ════════════ */}
      <View style={[styles.navOuter, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.navInner}>
          {NAV.map(({ key, label, Icon }) => (
            <TouchableOpacity
              key={key}
              style={styles.navTab}
              onPress={() => setNav(key)}
              activeOpacity={0.8}
            >
              {nav === key && <View style={styles.navInd} />}
              <Icon size={20} color={nav === key ? P.primary : P.muted} />
              <Text style={[styles.navLbl, nav === key && styles.navLblActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  Root — font loader + SafeAreaProvider
// ═════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    JetBrainsMono_700Bold,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <PomodoroScreen />
    </SafeAreaProvider>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  Styles
// ═════════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({

  // ── Root ──────────────────────────────────────────────────────────────────
  root: {
    flex: 1,
    backgroundColor: P.bg,
  },

  // ── Ambient glows ─────────────────────────────────────────────────────────
  glowTL: {
    position: 'absolute',
    width: 340, height: 340, borderRadius: 170,
    backgroundColor: P.glowTL,
    top: -90, left: -110,
  },
  glowBR: {
    position: 'absolute',
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: P.glowBR,
    bottom: 90, right: -80,
  },

  // ── Content wrapper ────────────────────────────────────────────────────────
  content: {
    flex: 1,
    paddingBottom: 130,  // clearance above fixed bottom nav
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 18,
  },
  hTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: P.fg,
    letterSpacing: 0.2,
  },
  hSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: P.muted,
    marginTop: 2,
  },

  // ── Mode selector ─────────────────────────────────────────────────────────
  modeBar: {
    flexDirection: 'row',
    marginHorizontal: 24,
    backgroundColor: P.tabBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: P.border,
    padding: 4,
    height: 44,
  },
  mTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  mTabActive: {
    backgroundColor: P.primary,
    shadowColor: P.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  mTabTxt: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: P.muted,
  },
  mTabTxtActive: {
    color: P.bg,
  },

  // ── Timer ring wrapper ─────────────────────────────────────────────────────
  ringWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 28,
  },
  ringGlow: {
    position: 'absolute',
    width: 296, height: 296, borderRadius: 148,
    backgroundColor: P.ringGlow,
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringMM: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 58,
    color: P.fg,
    lineHeight: 62,
  },
  ringSS: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 58,
    color: P.primary,
    lineHeight: 62,
    marginTop: -6,
  },
  ringMode: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: P.muted,
    letterSpacing: 4,
    marginTop: 8,
  },

  // ── Session dots ──────────────────────────────────────────────────────────
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 28,
  },
  dot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: P.dot,
  },
  dotOn: {
    backgroundColor: P.primary,
    shadowColor: P.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 6,
    elevation: 5,
  },

  // ── Controls ──────────────────────────────────────────────────────────────
  ctrlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 24,
  },
  sideBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: P.card,
    borderWidth: 1,
    borderColor: P.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: P.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 10,
  },

  // ── Stats cards ───────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 12,
  },
  card: {
    flex: 1,
    backgroundColor: P.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: P.border,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 6,
  },
  cardVal: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 20,
    color: P.fg,
  },
  cardLbl: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    color: P.muted,
    letterSpacing: 1.5,
  },

  // ── Bottom nav ────────────────────────────────────────────────────────────
  navOuter: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  navInner: {
    flexDirection: 'row',
    backgroundColor: P.navBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: P.border,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  navTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 4,
  },
  navInd: {
    position: 'absolute',
    top: 0, left: 4, right: 4, bottom: 0,
    backgroundColor: P.navInd,
    borderRadius: 12,
  },
  navLbl: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    color: P.muted,
  },
  navLblActive: {
    color: P.primary,
  },
});
