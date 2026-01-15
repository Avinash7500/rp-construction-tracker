import { signOut } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";

export const logout = async () => {
  await signOut(auth);
};
