const LoadingSpinner = ({ size = 48, className = "" }) => {
  return (
    <div
      className={`rounded-full border-2 border-[#000000] border-t-[#a27bff] [animation:spin_1s_linear_infinite] ${className}`}
      style={{ height: `${size}px`, width: `${size}px` }}
      aria-hidden="true"
    />
  );
};

export default LoadingSpinner;
