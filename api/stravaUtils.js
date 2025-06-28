// Node/serverless-only code. Do not import this file in the frontend!
import strava from 'strava-v3';
import { DEFAULT_PACE_BANDS } from './stravaPaceTypes.js';

/**
 * Fetches Strava activity streams and calculates average running pace (min/km).
 * @param activityId Strava activity ID
 * @param accessToken Strava OAuth access token
 * @returns Average pace in min/km, or null if not available
 */
export async function getRunPace(activityId, accessToken) {
  try {
    const streams = await strava.streams.activity({
      id: activityId,
      types: ['velocity_smooth', 'distance', 'time'],
      key_by_type: true,
      access_token: accessToken,
    });

    // Prefer velocity_smooth for pace calculation
    if (streams.velocity_smooth && streams.velocity_smooth.data.length > 0) {
      const avgVelocity =
        streams.velocity_smooth.data.reduce((a, b) => a + b, 0) /
        streams.velocity_smooth.data.length;
      if (avgVelocity > 0) {
        // 16.6667 / velocity (m/s) = min/km
        return 16.6667 / avgVelocity;
      }
    }
    // Fallback: use total distance and time
    if (streams.distance && streams.time) {
      const totalDistance = streams.distance.data[streams.distance.data.length - 1]; // meters
      const totalTime = streams.time.data[streams.time.data.length - 1]; // seconds
      if (totalDistance > 0) {
        return (totalTime / 60) / (totalDistance / 1000); // min/km
      }
    }
    return null;
  } catch (error) {
    console.error('Error fetching Strava streams:', error);
    return null;
  }
}

/**
 * Computes the pace distribution for a set of activities.
 * @param activityIds List of Strava activity IDs
 * @param accessToken Strava OAuth access token
 * @param interval Interval in seconds (e.g., 15, 30, 60)
 * @param mode 'time' (default) or 'distance'
 * @param paceBands Optional custom pace bands
 * @returns Distribution of time or distance in each pace band
 */
export async function getPaceDistribution(
  activityIds,
  accessToken,
  interval = 30,
  mode = 'time',
  paceBands = DEFAULT_PACE_BANDS
) {
  // Initialize tally for each band
  const bandTotals = new Array(paceBands.length).fill(0);

  for (const activityId of activityIds) {
    let streams;
    try {
      streams = await strava.streams.activity({
        id: activityId,
        types: ['distance', 'time', 'velocity_smooth'],
        key_by_type: true,
        access_token: accessToken,
      });
      console.log('Streams for activity', activityId, streams);
    } catch (error) {
      console.error('Error fetching streams for activity', activityId, error);
      continue;
    }
    const { time, distance, velocity_smooth } = streams;
    if (!time || !distance) continue;
    // Use velocity_smooth if available, else calculate from distance/time
    const n = Math.min(time.data.length, distance.data.length);
    console.log('About to process segments for activity', activityId, 'n =', n);
    for (let i = 1; i < n; ) {
      // Find the next interval boundary
      const t0 = time.data[i - 1];
      let j = i;
      while (j < n && time.data[j] - t0 < interval) j++;
      if (j >= n) break;
      const t1 = time.data[j];
      const dt = t1 - t0;
      const d0 = distance.data[i - 1];
      const d1 = distance.data[j];
      const dd = d1 - d0;
      // Calculate pace (min/km)
      let pace;
      if (velocity_smooth && velocity_smooth.data.length > j) {
        // Use average velocity in this interval
        const avgVel =
          velocity_smooth.data.slice(i - 1, j).reduce((a, b) => a + b, 0) /
          (j - (i - 1));
        pace = avgVel > 0 ? 16.6667 / avgVel : 99;
      } else {
        // Use distance/time
        pace = dd > 0 ? (dt / 60) / (dd / 1000) : 99;
      }
      // Find the band
      const bandIdx = paceBands.findIndex(b => pace >= b.min && pace < b.max);
      console.log(`Segment [${i - 1}-${j}] pace: ${pace.toFixed(2)} min/km, band: ${bandIdx !== -1 ? paceBands[bandIdx].label : 'none'}`);
      if (bandIdx !== -1) {
        if (mode === 'time') {
          bandTotals[bandIdx] += dt;
        } else {
          bandTotals[bandIdx] += dd;
        }
      }
      i = j;
    }
  }
  return {
    bands: paceBands,
    values: bandTotals,
    mode,
  };
} 