import SignInForm from "./_component/signin-form";
import Logo from "@/components/logo/logo";
import dashboardImg from "../../assets/images/dashboard_.png";
import dashboardImgDark from "../../assets/images/dashboard_dark.png";
import { useTheme } from "@/context/theme-provider";

const SignIn = () => {
  const { theme } = useTheme();
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 bg-gradient-to-b from-blue-50 to-blue-100 dark:from-[#0d1b36] dark:to-[#0B1120] p-6 md:p-10 md:pt-6 border-r border-blue-200 dark:border-white/5">
        <div className="flex justify-center gap-2 md:justify-start">
          <Logo url="/" />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <SignInForm />
          </div>
        </div>
      </div>
      <div className="relative hidden lg:block -mt-3 bg-gradient-to-br from-[#162340] via-[#0d1b36] to-[#0B1120]">
        <div className="absolute inset-0 flex flex-col items-end justify-end pt-8 pl-8">
          <div className="w-full max-w-3xl mx-0 pr-5">
            <h1 className="text-3xl font-bold text-white">
              Hi, I'm your AI-powered personal finance app, Pocket Planner!
            </h1>
            <p className="mt-4 text-blue-200/80">
              Pocket Planner provides insights, monthly reports, CSV import, recurring transactions, all powered by advanced AI technology. 🚀
            </p>
          </div>
          <div className="relative max-w-3xl h-full w-full overflow-hidden mt-3">
            <div className="rounded-tl-3xl rounded-bl-3xl rounded-br-3xl rounded-tr-none overflow-hidden border-4 border-r-0 border-black shadow-lg">
              <img
                src={theme === "dark" ? dashboardImgDark : dashboardImg}
                alt="Dashboard"
                className="w-full h-full object-cover"
                style={{
                  objectPosition: "left top",
                  transform: "scale(1.2)",
                  transformOrigin: "left top",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
