import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL ?? 'https://be-distributor-snack.vercel.app/api';

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const attendanceService = {
  async getToday() {
    const { data } = await api.get('/attendance/today');
    return data as { attendance: AttendanceRecord | null };
  },

  async getHistory() {
    const { data } = await api.get('/attendance/history');
    return data as { history: AttendanceRecord[] };
  },

  async clockIn(payload: { latitude: number; longitude: number; address?: string; face_image_url?: string | null }) {
    const { data } = await api.post('/attendance/clock-in', payload);
    return data as { attendance: AttendanceRecord; message: string };
  },

  async clockOut(payload: { latitude: number; longitude: number; address?: string; face_image_url?: string | null }) {
    const { data } = await api.put('/attendance/clock-out', payload);
    return data as { attendance: AttendanceRecord; message: string };
  },
};

export interface AttendanceRecord {
  id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  clock_in_lat: number | null;
  clock_in_lng: number | null;
  clock_in_address: string | null;
  clock_in_photo: string | null;
  clock_out_lat: number | null;
  clock_out_lng: number | null;
  clock_out_address: string | null;
  clock_out_photo: string | null;
  status: string;
}
