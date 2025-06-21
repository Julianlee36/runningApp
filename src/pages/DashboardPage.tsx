import React, { useEffect, useState } from 'react';
import Card from '../components/ui/Card';
import { supabase } from '../lib/supabaseClient';
import { User } from '@supabase/supabase-js';

// Define the type for an activity
interface Activity {
  id: number;
  title: string;
  distance: number;
  duration: number;
  elevation: number | null;
  activity_date: string;
}

// Define the type for a user profile
interface Profile {
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  strava_athlete_id: number | null;
}

const DashboardPage: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [newActivity, setNewActivity] = useState({
    title: '',
    distance: '',
    duration: '',
    elevation: '',
    activity_date: new Date().toISOString().substring(0, 10),
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const isStravaConnected = profile?.strava_athlete_id;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        // Fetch profile
        const { data: profileData, error: profileError } = await supabase
          .from('users')
          .select('first_name, last_name, avatar_url, strava_athlete_id')
          .eq('id', user.id)
          .single();

        if (profileError) {
          setError(profileError.message);
        } else {
          setProfile(profileData);
        }

        // Fetch activities
        const { data, error } = await supabase
          .from('activities')
          .select('*')
          .eq('user_id', user.id)
          .order('activity_date', { ascending: false });

        if (error) {
          setError(error.message);
        } else {
          setActivities(data || []);
        }
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewActivity(prev => ({ ...prev, [name]: value }));
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const activityToInsert = {
      user_id: user.id,
      title: newActivity.title,
      distance: parseFloat(newActivity.distance),
      duration: parseInt(newActivity.duration, 10) * 60, // Assuming duration is in minutes
      elevation: newActivity.elevation ? parseFloat(newActivity.elevation) : null,
      activity_date: newActivity.activity_date,
    };

    const { data, error } = await supabase
      .from('activities')
      .insert([activityToInsert])
      .select();

    if (error) {
      setError(error.message);
    } else if (data) {
      setActivities(prev => [data[0], ...prev]);
      setNewActivity({
        title: '',
        distance: '',
        duration: '',
        elevation: '',
        activity_date: new Date().toISOString().substring(0, 10),
      });
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !user) {
      return;
    }

    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}.${fileExt}`;
    const filePath = `${fileName}`;

    setUploading(true);

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      setError(uploadError.message);
    } else {
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);
      
      if (updateError) {
        setError(updateError.message);
      } else {
        setProfile(prev => ({ ...prev!, avatar_url: publicUrl }));
      }
    }
    setUploading(false);
  };

  const handleStravaConnect = () => {
    const stravaAuthorizeUrl = `https://www.strava.com/oauth/authorize?client_id=${import.meta.env.VITE_STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${window.location.origin}/strava/callback&approval_prompt=force&scope=read,activity:read_all`;
    window.location.href = stravaAuthorizeUrl;
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Your Dashboard</h1>
        <div className="flex items-center gap-4">
          {user && <span className="text-gray-700">{user.email}</span>}
          <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <Card>
            <h2 className="text-xl font-semibold mb-4">Your Activities</h2>
            {loading && <p>Loading activities...</p>}
            {error && <p className="text-red-500">{error}</p>}
            {!loading && activities.length === 0 && (
              <p>You haven't logged any activities yet.</p>
            )}
            <ul className="space-y-4">
              {activities.map(activity => (
                <li key={activity.id} className="p-4 bg-gray-50 rounded-lg shadow">
                  <h3 className="font-bold text-lg">{activity.title}</h3>
                  <p>Date: {new Date(activity.activity_date).toLocaleDateString()}</p>
                  <p>Distance: {activity.distance} km</p>
                  <p>Duration: {activity.duration / 60} minutes</p>
                  {activity.elevation && <p>Elevation: {activity.elevation} m</p>}
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <div>
          <Card>
            <h2 className="text-xl font-semibold mb-4">Your Profile</h2>
            <div className="flex flex-col items-center space-y-4">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Avatar"
                  className="w-32 h-32 rounded-full object-cover"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-gray-300 flex items-center justify-center">
                  <span className="text-gray-500">No Avatar</span>
                </div>
              )}
              <label htmlFor="avatar-upload" className="cursor-pointer bg-gray-200 p-2 rounded-lg hover:bg-gray-300">
                {uploading ? 'Uploading...' : 'Upload Avatar'}
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={uploading}
                className="hidden"
              />
            </div>
          </Card>
          <div className="mt-8">
            <Card>
              <h2 className="text-xl font-semibold mb-4">Integrations</h2>
              {isStravaConnected ? (
                <p className="text-green-600">✓ Connected to Strava</p>
              ) : (
                <button
                  onClick={handleStravaConnect}
                  className="w-full bg-orange-500 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded"
                >
                  Connect with Strava
                </button>
              )}
            </Card>
          </div>
          <div className="mt-8">
            <Card>
              <h2 className="text-xl font-semibold mb-4">Add New Activity</h2>
              <form onSubmit={handleAddActivity} className="space-y-4">
                <input
                  type="text"
                  name="title"
                  placeholder="Title (e.g., Morning Run)"
                  value={newActivity.title}
                  onChange={handleInputChange}
                  required
                  className="w-full p-2 border rounded"
                />
                <input
                  type="date"
                  name="activity_date"
                  value={newActivity.activity_date}
                  onChange={handleInputChange}
                  required
                  className="w-full p-2 border rounded"
                />
                <input
                  type="number"
                  name="distance"
                  placeholder="Distance (km)"
                  value={newActivity.distance}
                  onChange={handleInputChange}
                  required
                  step="0.01"
                  className="w-full p-2 border rounded"
                />
                <input
                  type="number"
                  name="duration"
                  placeholder="Duration (minutes)"
                  value={newActivity.duration}
                  onChange={handleInputChange}
                  required
                  className="w-full p-2 border rounded"
                />
                <input
                  type="number"
                  name="elevation"
                  placeholder="Elevation (m)"
                  value={newActivity.elevation}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded"
                />
                <button
                  type="submit"
                  className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                >
                  Add Activity
                </button>
              </form>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage; 