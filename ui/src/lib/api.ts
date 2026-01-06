import axios from "axios";
import { API_BASE_URL } from "@/lib/env";

export const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10_000
});
