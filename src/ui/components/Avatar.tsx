import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { makeStyles, useTheme } from '../ThemeProvider';
import { font } from '../theme';
import { Glyph, type GlyphSpec } from './Glyph';

interface Props {
  uri?: string | null;
  /** Used for the monogram fallback. */
  name: string;
  size?: number;
  /** Tickers read better as a square badge than a circle. */
  square?: boolean;
  /**
   * The image is a company logo rather than a photograph.
   *
   * The two need opposite treatment. A portrait is edge-to-edge and should fill
   * its frame, cropping if it must. A logo is artwork on a transparent
   * background, drawn for a light surface: Intel's is 97% near-black pixels,
   * which on this app's dark chrome is an empty square. So a logo gets a light
   * plate to sit on, and is fitted rather than cropped — a wide wordmark filled
   * to a square would lose its ends.
   */
  logo?: boolean;
  /**
   * A mark to draw instead of the monogram when there is no image — a party's
   * animal, say, where initials like "RE" would mean nothing.
   */
  glyph?: GlyphSpec;
}

/**
 * Avatar with a monogram fallback. Remote avatars fail routinely — a logo 404s
 * for any symbol the provider doesn't stock, and congressional portraits are
 * missing for anyone who left mid-term — so the fallback is a normal path, not
 * an edge case.
 */
export function Avatar({
  uri,
  name,
  size = 40,
  square = false,
  logo = false,
  glyph,
}: Props) {
  const c = useTheme();
  const styles = useStyles();
  // Neutral in every mode: identity comes from the name and the source's
  // icon, not a colour per source or party, so the accents keep meaning
  // direction and action and nothing else. `textMuted` on `surfaceAlt`
  // clears AA in all three modes.
  const ink = c.textMuted;
  const [failed, setFailed] = useState(false);
  const initials = monogram(name);

  // A failure belongs to the URL that produced it, not to this component slot.
  // Without this reset, one 404 pinned the monogram on permanently: any later
  // avatar for the same row — a watchlist entry re-fetched with a real image,
  // or a recycled list position — kept showing initials with no way back.
  useEffect(() => {
    setFailed(false);
  }, [uri]);

  const shape = {
    width: size,
    height: size,
    borderRadius: square ? Math.round(size / 4) : size / 2,
  };

  if ((!uri || failed) && glyph) {
    return (
      <View style={[styles.fallback, shape, { backgroundColor: c.surfaceAlt }]}>
        <Glyph glyph={glyph} size={size * 0.5} color={ink} />
      </View>
    );
  }

  if (!uri || failed) {
    return (
      <View style={[styles.fallback, shape, { backgroundColor: c.surfaceAlt }]}>
        {/*
          The one place text deliberately does not scale with the system size.
          The monogram is sized as a fraction of a fixed-size avatar box that
          cannot grow with it, so honouring Dynamic Type here would push the
          initials straight out of their circle. It carries no information the
          row's label doesn't already say.
        */}
        <Text
          style={[styles.initials, { color: ink, fontSize: size * 0.36 }]}
          numberOfLines={1}
          allowFontScaling={false}
        >
          {initials}
        </Text>
      </View>
    );
  }

  if (logo) {
    return (
      <View style={[styles.plate, shape]}>
        <Image
          source={{ uri }}
          // Inset so the mark has room to breathe against the plate edge, and
          // `contain` so a wide wordmark keeps both of its ends.
          style={{ width: size - LOGO_INSET * 2, height: size - LOGO_INSET * 2 }}
          resizeMode="contain"
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
        />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={[styles.image, shape]}
      onError={() => setFailed(true)}
      accessibilityIgnoresInvertColors
    />
  );
}

function monogram(name: string): string {
  const clean = name.replace(/^[@$]/, '').trim();
  if (!clean) return '?';

  // Tickers (AAPL, BTC-USD) read best as the leading symbol itself.
  if (/^[A-Z0-9.\-]{1,6}$/.test(clean)) return clean.slice(0, 4);

  const words = clean.split(/[\s_]+/).filter(Boolean);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  return clean.slice(0, 2).toUpperCase();
}

/** Breathing room between a logo and its plate edge, per side. */
const LOGO_INSET = 5;

const useStyles = makeStyles((c) => ({
  image: {
    backgroundColor: c.surfaceAlt,
  },
  /**
   * A near-white plate so every logo is legible, whatever colour it is.
   *
   * `logoPlate`, which is off-white in both themes. This used to be `c.text`,
   * which matched in dark but turned every plate near-black in light — the
   * opposite of what transparent logo artwork drawn for white needs.
   */
  plate: {
    backgroundColor: c.logoPlate,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: font.bold,
    letterSpacing: -0.2,
  },
}));
