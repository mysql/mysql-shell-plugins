//  This is a no-op. This is used to work around the problem that we can't use 'if' statements.
//  An example of this is the initialization of the databases. We have to do it only once, so after
//  calling it, we should set the initialization operation to this. The next time the initialization operation
//  is called, it will be a no-op.