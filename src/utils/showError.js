import toast from "react-hot-toast";

export const showError = (error, fallback = "Something went wrong") => {
  console.error(error);

  if (typeof error === "string") {
    toast.error(error);
    return;
  }

  if (error?.message) {
    toast.error(error.message);
    return;
  }

  toast.error(fallback);
};
