const supabase = require('../supabase/supabaseConnect');

/**
 * Create a new schedule
 */
async function createSchedule(scheduleData) {
  const { data, error } = await supabase
    .from('schedules')
    .insert(scheduleData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get schedules for a user with optional filtering
 */
async function getSchedules(userId, { status = 'all', limit = 20, offset = 0 } = {}) {
  let query = supabase
    .from('schedules')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('next_execution', { ascending: true })
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

  if (status === 'active') {
    query = query.eq('status', 'active');
  } else if (status === 'paused') {
    query = query.eq('status', 'paused');
  } else if (status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, count, error } = await query;
  if (error) throw error;
  return { schedules: data, total: count };
}

/**
 * Get a single schedule by ID and user
 */
async function getScheduleById(scheduleId, userId) {
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('id', scheduleId)
    .eq('user_id', userId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a schedule
 */
async function updateSchedule(scheduleId, userId, updates) {
  const { data, error } = await supabase
    .from('schedules')
    .update(updates)
    .eq('id', scheduleId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a schedule
 */
async function deleteSchedule(scheduleId, userId) {
  const { error } = await supabase
    .from('schedules')
    .delete()
    .eq('id', scheduleId)
    .eq('user_id', userId);

  if (error) throw error;
  return true;
}

/**
 * Get schedule by ID only (for webhook execution - no user filter)
 */
async function getScheduleByIdOnly(scheduleId) {
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('id', scheduleId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update schedule after execution (uses service role)
 */
async function updateScheduleAfterExecution(scheduleId, updates) {
  const { data, error } = await supabase
    .from('schedules')
    .update(updates)
    .eq('id', scheduleId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

module.exports = {
  createSchedule,
  getSchedules,
  getScheduleById,
  updateSchedule,
  deleteSchedule,
  getScheduleByIdOnly,
  updateScheduleAfterExecution
};
