import { describe, expect, it } from 'vitest';
import { RadioPlayerService } from './radio-player';

describe('RadioPlayerService', () => {
  it('should select Poland initially', () => {
    const player = new RadioPlayerService();

    expect(player.countryCode()).toBe('PL');
    expect(player.selectedStation()?.name).toBe('RMF FM');
  });

  it('should change country and available stations', () => {
    const player = new RadioPlayerService();

    player.selectCountry('GB');

    expect(player.countryCode()).toBe('GB');
    expect(player.selectedStation()?.name).toBe('BBC Radio 1');
  });

  it('should change station', () => {
    const player = new RadioPlayerService();

    player.selectStation('pl-zet');

    expect(player.selectedStation()?.name).toBe('Radio ZET');
  });

  it('should ignore invalid station', () => {
    const player = new RadioPlayerService();

    player.selectStation('unknown');

    expect(player.selectedStation()?.id).toBe('pl-rmf');
  });

  it('should clamp volume between zero and 100', () => {
    const player = new RadioPlayerService();

    player.setVolumePercent(150);
    expect(player.volumePercent()).toBe(100);

    player.setVolumePercent(-10);
    expect(player.volumePercent()).toBe(0);

    player.setVolumePercent(45);
    expect(player.volumePercent()).toBe(45);
  });

  it('should not play station without stream URL', async () => {
    const player = new RadioPlayerService();

    const result = await player.play();

    expect(result).toBe(false);
    expect(player.isPlaying()).toBe(false);
    expect(player.errorKey()).toBe('radio.streamUnavailable');
  });

  it('should stop playback state', () => {
    const player = new RadioPlayerService();

    player.isPlaying.set(true);
    player.stop();

    expect(player.isPlaying()).toBe(false);
  });
});
