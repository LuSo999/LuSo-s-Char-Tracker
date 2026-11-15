{
  description = "LuSo Sheet Tool: fill any character sheet PDF from a LuSo's Char Tracker character, and read filled sheets back";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    systems.url = "github:nix-systems/default-linux";
    flake-utils = {
      url = "github:numtide/flake-utils";
      inputs.systems.follows = "systems";
    };
  };

  outputs =
    { nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        inherit (pkgs) lib;
        desktop = lib.importJSON ./desktop/package.json;
        nodejs = pkgs.nodejs_24; # build time only
        electron = pkgs.electron_45; # run time

        # Run time: the dependencies of desktop/ (the Claude, OpenAI and Gemini SDKs), without
        # its devDependencies (Electron, electron-builder).
        runtimeModules = pkgs.importNpmLock.buildNodeModules {
          npmRoot = ./desktop;
          inherit nodejs;
          derivationArgs.npmFlags = [ "--omit=dev" ];
        };
      in
      {
        packages.default = pkgs.buildNpmPackage {
          pname = "luso-sheet-tool";
          inherit (desktop) version;
          inherit nodejs;
          src = ./.;

          # Build time: the root package-lock.json (Vite, React, Tailwind), which builds the page
          # into desktop/dist. importNpmLock uses the lock file's own hashes: no npmDepsHash.
          npmDeps = pkgs.importNpmLock { npmRoot = ./.; };
          npmConfigHook = pkgs.importNpmLock.npmConfigHook;

          nativeBuildInputs = [
            pkgs.makeWrapper
            pkgs.copyDesktopItems
            pkgs.removeReferencesTo
          ];

          buildPhase = ''
            runHook preBuild
            npm --prefix desktop run build
            runHook postBuild
          '';

          installPhase = ''
            runHook preInstall

            app=$out/share/luso-sheet-tool
            mkdir -p $app
            cp -r desktop/package.json desktop/electron desktop/dist $app/
            cp -r --no-preserve=mode ${runtimeModules}/node_modules $app/
            # npm's bookkeeping lists the source tarballs, and the SDKs' command-line scripts (which
            # the app never runs) point at the build's Node.js: neither belongs to the app.
            rm $app/node_modules/.package-lock.json
            grep -rlZ ${nodejs} $app/node_modules | xargs -0r remove-references-to -t ${nodejs}

            install -Dm644 desktop/build/icon.png $out/share/icons/hicolor/512x512/apps/luso-sheet-tool.png
            makeWrapper ${lib.getExe electron} $out/bin/luso-sheet-tool \
              --add-flags $app \
              --add-flags "\''${NIXOS_OZONE_WL:+\''${WAYLAND_DISPLAY:+--ozone-platform-hint=auto --enable-features=WaylandWindowDecorations --enable-wayland-ime=true}}"

            runHook postInstall
          '';

          desktopItems = [
            (pkgs.makeDesktopItem {
              name = "luso-sheet-tool";
              desktopName = desktop.productName;
              comment = desktop.description;
              exec = "luso-sheet-tool %U";
              icon = "luso-sheet-tool";
              categories = [ "Utility" ];
              startupWMClass = desktop.productName;
            })
          ];

          # At run time the app needs only Electron (which brings its own Node.js) and the shell of
          # its launcher; the build fails if anything else, such as Node.js, ends up referenced.
          allowedReferences = [
            "out"
            electron
            pkgs.runtimeShellPackage
          ];

          meta = {
            inherit (desktop) description;
            homepage = "https://github.com/LuSo999/LuSo-s-Char-Tracker";
            license = lib.licenses.mit;
            mainProgram = "luso-sheet-tool";
            inherit (electron.meta) platforms;
          };
        };

        formatter = pkgs.nixfmt;
      }
    );
}
