import { pool } from './db';

async function addIndexes() {
  const client = await pool.connect();
  
  try {
    console.log('Adding database indexes...\n');
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_routes_user_id ON routes(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_waypoints_user_id ON waypoints(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_map_drawings_user_id ON map_drawings(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_drone_images_user_id ON drone_images(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_locations_user_id ON locations(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_offline_map_areas_user_id ON offline_map_areas(user_id)',

      'CREATE INDEX IF NOT EXISTS idx_activities_user_start ON activities(user_id, start_time DESC)',

      'CREATE INDEX IF NOT EXISTS idx_routes_is_public ON routes(is_public) WHERE is_public = true',

      'CREATE INDEX IF NOT EXISTS idx_route_shares_route_id ON route_shares(route_id)',
      'CREATE INDEX IF NOT EXISTS idx_route_shares_shared_with ON route_shares(shared_with_user_id)',
      'CREATE INDEX IF NOT EXISTS idx_route_shares_shared_by ON route_shares(shared_by_user_id)',

      'CREATE INDEX IF NOT EXISTS idx_route_notes_route_id ON route_notes(route_id)',
      'CREATE INDEX IF NOT EXISTS idx_route_pois_route_id ON route_points_of_interest(route_id)',

      'CREATE INDEX IF NOT EXISTS idx_friend_requests_requester ON friend_requests(requester_id)',
      'CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON friend_requests(receiver_id)',
      'CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON friend_requests(receiver_id, status)',
      'CREATE INDEX IF NOT EXISTS idx_friendships_user_a ON friendships(user_a_id)',
      'CREATE INDEX IF NOT EXISTS idx_friendships_user_b ON friendships(user_b_id)',

      'CREATE INDEX IF NOT EXISTS idx_location_shares_from ON location_shares(from_user_id)',
      'CREATE INDEX IF NOT EXISTS idx_location_shares_to ON location_shares(to_user_id)',
      'CREATE INDEX IF NOT EXISTS idx_location_shares_status ON location_shares(to_user_id, status)',
      'CREATE INDEX IF NOT EXISTS idx_user_locations_user_id ON user_locations(user_id)',

      'CREATE INDEX IF NOT EXISTS idx_live_map_sessions_owner ON live_map_sessions(owner_id)',
      'CREATE INDEX IF NOT EXISTS idx_live_map_sessions_share_code ON live_map_sessions(share_code)',
      'CREATE INDEX IF NOT EXISTS idx_live_map_sessions_active ON live_map_sessions(is_active) WHERE is_active = true',
      'CREATE INDEX IF NOT EXISTS idx_live_map_members_session ON live_map_members(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_live_map_members_user ON live_map_members(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_live_map_pois_session ON live_map_pois(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_live_map_routes_session ON live_map_routes(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_live_map_messages_session ON live_map_messages(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_live_map_invites_to ON live_map_invites(to_user_id)',
      'CREATE INDEX IF NOT EXISTS idx_live_map_invites_session ON live_map_invites(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_live_map_gps_tracks_session ON live_map_gps_tracks(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_live_map_gps_tracks_user ON live_map_gps_tracks(user_id)',

      'CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_calendar_events_trip ON calendar_events(trip_id)',
      'CREATE INDEX IF NOT EXISTS idx_calendar_events_user ON calendar_events(user_id)',

      'CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token)',
      'CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id)',

      'CREATE INDEX IF NOT EXISTS idx_drone_models_drone_image ON drone_models(drone_image_id)',
      'CREATE INDEX IF NOT EXISTS idx_drone_models_user ON drone_models(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_cesium_tilesets_drone_image ON cesium_3d_tilesets(drone_image_id)',
      'CREATE INDEX IF NOT EXISTS idx_cesium_tilesets_user ON cesium_3d_tilesets(user_id)',

      'CREATE INDEX IF NOT EXISTS idx_waypoint_shares_waypoint ON waypoint_shares(waypoint_id)',
      'CREATE INDEX IF NOT EXISTS idx_waypoint_shares_user ON waypoint_shares(shared_with_user_id)',
    ];
    
    let created = 0;
    for (const sql of indexes) {
      try {
        await client.query(sql);
        const indexName = sql.match(/IF NOT EXISTS (\S+)/)?.[1] || 'unknown';
        console.log(`  ✓ ${indexName}`);
        created++;
      } catch (err: any) {
        const indexName = sql.match(/IF NOT EXISTS (\S+)/)?.[1] || 'unknown';
        console.error(`  ✗ ${indexName}: ${err.message}`);
      }
    }
    
    console.log(`\nDone! ${created}/${indexes.length} indexes created or verified.`);
    
  } finally {
    client.release();
    await pool.end();
  }
}

addIndexes().catch(console.error);
