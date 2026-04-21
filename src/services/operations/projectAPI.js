import { apiConnector } from "../apiConnector";
import { toast } from "react-hot-toast";
import { projectsEndpoints } from "../api";
const { GET_USER_SESSIONS_API } = projectsEndpoints;

export function fetchUserSessions() {
  return async (dispatch) => {
    try {

      const token = JSON.parse(localStorage.getItem("token"));

      const response = await apiConnector(
        "GET", 
        GET_USER_SESSIONS_API, 
        null, 
        {
          Authorization: `Bearer ${token}`,
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.message);
      }

      const projectsData = response.data.data;

      return projectsData; 

    } catch (error) {
      console.log("FETCH_USER_PROJECTS API ERROR............", error);

      toast.error(
        error?.response?.data?.message || 
        error?.message || 
        "Failed to load projects"
      );
      
      return false;
    }
  };
}