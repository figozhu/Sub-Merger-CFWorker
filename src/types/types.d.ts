
enum SubscriptionType {
    Monthly = "包年/包月",
    TrafficPackage = "流量包"
}

interface SubUserInfo {
    upload: number;
    download: number;
    total: number;
    expire: number;
}

interface FinalObj {
    subUserInfo: SubUserInfo;
    finalYaml: string;
}

export {
    SubscriptionType,
    SubUserInfo,
    FinalObj
}
