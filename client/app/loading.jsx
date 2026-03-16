import LoadingSpinner from "./components/LoadingSpinner";

const Loading = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#000000]">
      <LoadingSpinner size={48} />
    </div>
  );
};

export default Loading;
