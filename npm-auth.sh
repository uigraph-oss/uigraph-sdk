aws codeartifact associate-external-connection \
	--domain uigraph-sdk \
	--repository npm \
	--external-connection public:npmjs

aws codeartifact login \
	--tool npm \
	--domain uigraph-sdk \
	--repository npm
